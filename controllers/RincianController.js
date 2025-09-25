const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function calculateRincianPercentage(rincian) {
  // 1. Dapatkan Denominator: Total flag yang dibutuhkan untuk KodeAkun ini.
  const totalRequiredFlags = await prisma.flag.count({
    where: { kodeAkunId: rincian.kodeAkunId },
  });

  // Jika tidak ada flag persyaratan, maka dianggap 100% lengkap.
  if (totalRequiredFlags === 0) {
    return 100;
  }

  // 2. Dapatkan Numerator: Total jawaban 'IYA' untuk rincian ini.
  // Kita tidak perlu query tambahan karena jawabanFlags sudah di-include.
  const totalJawabanIya = rincian.jawabanFlags.filter(
    (flag) => flag.tipe === 'IYA'
  ).length;

  // 3. Kalkulasi dan pembulatan.
  return Math.round((totalJawabanIya / totalRequiredFlags) * 100);
}

// @desc    Mendapatkan semua rincian (dengan filter peran dan kalkulasi persentase)
// @route   GET /api/rincian
// @access  Private
exports.getAllRincian = async (req, res) => {
  try {
    const whereClause = {};

    // Filter keamanan berdasarkan peran pengguna: op_satker hanya bisa melihat rincian miliknya.
    if (req.user.role === 'op_satker') {
      if (!req.user.satkerId) {
        return res.status(403).json({
          error:
            'Akses ditolak: Data Satker tidak ditemukan untuk pengguna ini.',
        });
      }
      // Filter rincian berdasarkan satkerId dari SPM induknya.
      whereClause.spm = {
        satkerId: req.user.satkerId,
      };
    }
    // Untuk peran lain (op_prov, supervisor), whereClause tetap kosong, mengambil semua data.

    const allRincian = await prisma.spmRincian.findMany({
      where: whereClause,
      orderBy: { spm: { tanggal: 'desc' } }, // Urutkan berdasarkan tanggal SPM terbaru
      include: {
        kodeAkun: true, // Butuh kodeAkunId untuk kalkulasi
        spm: {
          select: {
            nomorSpm: true,
            satker: {
              select: {
                nama: true, // Ambil nama satker untuk ditampilkan
              },
            },
          },
        },
        jawabanFlags: true, // Wajib di-include untuk kalkulasi persentase.
      },
    });

    // Kalkulasi persentase untuk setiap rincian secara paralel agar lebih cepat.
    await Promise.all(
      allRincian.map(async (rincian) => {
        // Panggil helper untuk menghitung dan tambahkan hasilnya ke objek
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );

        // Hapus jawabanFlags dari respons akhir agar payload lebih ringan (opsional)
        delete rincian.jawabanFlags;
      })
    );

    res.status(200).json(allRincian);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil daftar rincian.' });
  }
};
