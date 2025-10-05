const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- FUNGSI HELPER UNTUK KALKULASI PERSENTASE RINCIAN ---
async function calculateRincianPercentage(rincian) {
  if (!rincian.jawabanFlags) {
    rincian.jawabanFlags = await prisma.jawabanFlag.findMany({
      where: { rincianSpmId: rincian.id },
    });
  }
  const totalRequiredFlags = await prisma.flag.count({
    where: { kodeAkunId: rincian.kodeAkunId },
  });
  if (totalRequiredFlags === 0) return 100;

  const totalJawabanIya = rincian.jawabanFlags.filter(
    (flag) => flag.tipe === 'IYA'
  ).length;
  return Math.round((totalJawabanIya / totalRequiredFlags) * 100);
}

// @desc    Mendapatkan laporan kinerja per satker
// @route   GET /api/reports/satker-performance
// @access  Private (Hanya op_prov/supervisor)
exports.getSatkerPerformance = async (req, res) => {
  try {
    const { tahun } = req.query; // Ambil tahun dari query URL
    if (!tahun) {
      return res
        .status(400)
        .json({ error: 'Parameter tahun anggaran harus disertakan.' });
    }

    const tahunAnggaran = parseInt(tahun);

    // 1. Ambil semua satker
    const allSatkers = await prisma.satker.findMany();

    // 2. Untuk setiap satker, hitung metrik kinerjanya
    const performanceData = await Promise.all(
      allSatkers.map(async (satker) => {
        // Ambil semua SPM untuk satker dan tahun ini
        const spms = await prisma.spm.findMany({
          where: {
            satkerId: satker.id,
            tahunAnggaran: tahunAnggaran,
          },
          include: {
            rincian: { include: { jawabanFlags: true } },
          },
        });

        const totalSpm = spms.length;
        if (totalSpm === 0) {
          return {
            id: satker.id,
            nama: satker.nama,
            totalSpm: 0,
            totalDitolak: 0,
            rejectionRate: 0,
            averageCompleteness: 100, // Dianggap 100 jika tidak ada SPM
          };
        }

        // Hitung metrik
        const totalDitolak = spms.filter(
          (spm) => spm.status === 'DITOLAK'
        ).length;
        const rejectionRate = (totalDitolak / totalSpm) * 100;

        // Hitung rata-rata kelengkapan
        const spmCompletenessPercentages = await Promise.all(
          spms.map(async (spm) => {
            if (spm.rincian.length === 0) return 100;
            const rincianPercentages = await Promise.all(
              spm.rincian.map((r) => calculateRincianPercentage(r))
            );
            const total = rincianPercentages.reduce((sum, p) => sum + p, 0);
            return total / rincianPercentages.length;
          })
        );

        const totalCompleteness = spmCompletenessPercentages.reduce(
          (sum, p) => sum + p,
          0
        );
        const averageCompleteness =
          totalCompleteness / spmCompletenessPercentages.length;

        return {
          id: satker.id,
          nama: satker.nama,
          totalSpm,
          totalDitolak,
          rejectionRate: parseFloat(rejectionRate.toFixed(2)),
          averageCompleteness: parseFloat(averageCompleteness.toFixed(2)),
        };
      })
    );

    res.status(200).json(performanceData);
  } catch (error) {
    console.error('--- DETAIL ERROR KINERJA SATKER ---', error);
    res.status(500).json({ error: 'Gagal mengambil data kinerja satker.' });
  }
};
