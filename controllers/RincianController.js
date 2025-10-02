const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// --- FUNGSI HELPER (TIDAK BERUBAH) ---
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

// @desc    Mendapatkan semua rincian
// @route   GET /api/rincian
exports.getAllRincian = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role === 'op_satker') {
      if (!req.user.satkerId) {
        return res
          .status(403)
          .json({ error: 'Akses ditolak: Data Satker tidak ditemukan.' });
      }
      whereClause.spm = { satkerId: { equals: req.user.satkerId } };
    }

    const allRincian = await prisma.spmRincian.findMany({
      where: whereClause,
      orderBy: { spm: { tanggal: 'desc' } },
      include: {
        kodeAkun: true,
        jawabanFlags: true, // Wajib di-include untuk kalkulasi
        // --- PERBAIKAN UTAMA DI SINI ---
        // Menggunakan 'include' pada relasi 'spm' akan mengambil SEMUA field
        // dari SPM induknya, termasuk 'tanggal' dan 'status'.
        spm: {
          include: {
            satker: {
              select: { nama: true }, // Kita hanya butuh nama satker
            },
          },
        },
      },
    });

    // Kalkulasi persentase (logika ini tetap sama)
    await Promise.all(
      allRincian.map(async (rincian) => {
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );
        delete rincian.jawabanFlags; // Opsional: meringankan payload
      })
    );

    res.status(200).json(allRincian);
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL RINCIAN ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar rincian.' });
  }
};
