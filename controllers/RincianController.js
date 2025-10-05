const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- FUNGSI HELPER (Tidak berubah) ---
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

// @desc    Mendapatkan semua rincian (dengan filter)
// @route   GET /api/rincian
exports.getAllRincian = async (req, res) => {
  try {
    // --- PERUBAHAN DIMULAI DI SINI ---
    const { satkerId, tahun } = req.query; // Ambil satkerId & tahun dari query
    const whereClause = {};

    // 1. Terapkan filter TAHUN ANGGARAN jika ada
    if (tahun) {
      whereClause.spm = {
        ...whereClause.spm,
        tahunAnggaran: parseInt(tahun, 10),
      };
    }

    // 2. Terapkan filter SATKER berdasarkan peran user dan query param
    if (req.user.role === 'op_satker') {
      // Jika user adalah op_satker, paksa filter berdasarkan satkerId mereka
      whereClause.spm = { ...whereClause.spm, satkerId: req.user.satkerId };
    } else if (satkerId) {
      // Jika user adalah op_prov/supervisor dan memilih satker spesifik
      whereClause.spm = {
        ...whereClause.spm,
        satkerId: parseInt(satkerId, 10),
      };
    }
    // --- AKHIR PERUBAHAN ---

    const allRincian = await prisma.spmRincian.findMany({
      where: whereClause,
      orderBy: { spm: { tanggal: 'desc' } },
      include: {
        kodeAkun: true,
        jawabanFlags: true,
        spm: {
          include: {
            satker: {
              select: { nama: true },
            },
          },
        },
      },
    });

    // Kalkulasi persentase (tidak berubah)
    await Promise.all(
      allRincian.map(async (rincian) => {
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );
        delete rincian.jawabanFlags;
      })
    );

    res.status(200).json(allRincian);
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL RINCIAN ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar rincian.' });
  }
};
