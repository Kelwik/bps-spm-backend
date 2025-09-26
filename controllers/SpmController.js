const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// @desc    Membuat SPM baru beserta semua rinciannya
// @route   POST /api/spm
// @access  Private (setelah login)
async function calculateRincianPercentage(rincian) {
  // 1. Dapatkan Denominator: Total flag yang dibutuhkan untuk KodeAkun ini
  const totalRequiredFlags = await prisma.flag.count({
    where: { kodeAkunId: rincian.kodeAkunId },
  });

  // Jika tidak ada flag persyaratan, maka dianggap 100% lengkap
  if (totalRequiredFlags === 0) {
    return 100;
  }

  // 2. Dapatkan Numerator: Total jawaban 'IYA' untuk rincian ini
  // Kita tidak perlu query jawabanFlags lagi karena sudah di-include
  const totalJawabanIya = rincian.jawabanFlags.filter(
    (flag) => flag.tipe === 'IYA'
  ).length;

  // 3. Kalkulasi dan pembulatan
  return Math.round((totalJawabanIya / totalRequiredFlags) * 100);
}

// @desc    Membuat SPM baru beserta semua rinciannya
// @route   POST /api/spm
exports.createSpmWithRincian = async (req, res) => {
  try {
    const {
      nomorSpm,
      tahunAnggaran,
      tanggal,
      satkerId, // Ini mungkin datang sebagai string
      rincian,
    } = req.body;

    if (!rincian || rincian.length === 0) {
      return res
        .status(400)
        .json({ error: 'SPM harus memiliki setidaknya satu rincian.' });
    }

    const calculatedTotal = rincian.reduce((total, item) => {
      return total + (Number(item.jumlah) || 0);
    }, 0);

    const newSpm = await prisma.spm.create({
      data: {
        nomorSpm,
        tahunAnggaran,
        tanggal: new Date(tanggal),
        totalAnggaran: calculatedTotal,
        satker: { connect: { id: parseInt(satkerId) } },

        rincian: {
          create: rincian.map((r) => ({
            // Data yang sudah ada
            kodeProgram: r.kodeProgram,
            kodeKegiatan: r.kodeKegiatan,
            jumlah: parseInt(r.jumlah),
            kodeAkun: { connect: { id: parseInt(r.kodeAkunId) } },
            jawabanFlags: { create: r.jawabanFlags },

            // 👇 --- PENAMBAHAN FIELD BARU --- 👇
            kodeKRO: r.kodeKRO,
            kodeRO: r.kodeRO,
            kodeKomponen: r.kodeKomponen,
            kodeSubkomponen: r.kodeSubkomponen,
            uraian: r.uraian,
          })),
        },
      },
      include: {
        rincian: {
          include: {
            jawabanFlags: true,
          },
        },
      },
    });

    res.status(201).json(newSpm);
  } catch (error) {
    // Logging yang lebih baik untuk debugging di masa depan
    console.error('--- DETAIL ERROR PEMBUATAN SPM ---');
    console.error('KODE ERROR:', error.code); // Tampilkan kode error Prisma jika ada
    console.error('PESAN ERROR:', error.message);
    console.error('---------------------------------');

    // Tangani error spesifik jika nomor SPM sudah ada
    if (error.code === 'P2002') {
      // Kode Prisma untuk 'unique constraint failed'
      return res
        .status(409)
        .json({ error: `Nomor SPM '${req.body.nomorSpm}' sudah terdaftar.` });
    }

    res.status(500).json({ error: 'Gagal membuat SPM beserta rinciannya.' });
  }
};

// @desc    Mendapatkan semua SPM (dengan filter peran)
// @route   GET /api/spm
exports.getAllSpms = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role === 'op_satker') {
      whereClause.satkerId = req.user.satkerId;
    }

    const spms = await prisma.spm.findMany({
      where: whereClause,
      orderBy: {
        tanggal: 'desc',
      },
      include: {
        satker: {
          select: { nama: true },
        },
        _count: {
          select: { rincian: true },
        },
      },
    });
    res.status(200).json(spms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil daftar SPM.' });
  }
};

// @desc    Mendapatkan detail satu SPM (dengan kalkulasi persentase)
// @route   GET /api/spm/:id
exports.getSpmById = async (req, res) => {
  try {
    const { id } = req.params;
    const spm = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
      include: {
        satker: true,
        rincian: {
          include: {
            kodeAkun: true,
            jawabanFlags: true, // Include jawaban untuk kalkulasi
          },
        },
      },
    });

    if (!spm) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    // Verifikasi hak akses untuk op_satker
    if (req.user.role === 'op_satker' && spm.satkerId !== req.user.satkerId) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    // Kalkulasi persentase untuk setiap rincian secara paralel
    await Promise.all(
      spm.rincian.map(async (rincian) => {
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );
      })
    );

    res.status(200).json(spm);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data SPM.' });
  }
};

// @desc    Mengupdate SPM yang sudah ada
// @route   PUT /api/spm/:id
// @access  Private
exports.updateSpm = async (req, res) => {
  const { id } = req.params;
  const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian } = req.body;

  try {
    // Ambil ID rincian yang ada di database saat ini
    const existingRincian = await prisma.spmRincian.findMany({
      where: { spmId: parseInt(id) },
      select: { id: true },
    });
    const existingRincianIds = existingRincian.map((r) => r.id);

    // Dapatkan ID rincian dari data yang dikirim frontend
    const incomingRincianIds = rincian.filter((r) => r.id).map((r) => r.id);

    // Tentukan rincian mana yang harus dihapus
    const rincianToDeleteIds = existingRincianIds.filter(
      (existingId) => !incomingRincianIds.includes(existingId)
    );

    // === LANGKAH BARU 1: HITUNG KEMBALI TOTAL ANGGARAN ===
    const calculatedTotal = rincian.reduce((total, item) => {
      return total + (Number(item.jumlah) || 0);
    }, 0);
    // Jalankan semua operasi dalam satu transaksi
    const updatedSpm = await prisma.$transaction(async (tx) => {
      // 1. Hapus rincian yang tidak lagi ada
      if (rincianToDeleteIds.length > 0) {
        await tx.spmRincian.deleteMany({
          where: { id: { in: rincianToDeleteIds } },
        });
      }

      // 2. Update data utama SPM
      const spm = await tx.spm.update({
        where: { id: parseInt(id) },
        data: {
          nomorSpm,
          tahunAnggaran,
          tanggal: new Date(tanggal),
          satkerId,
          totalAnggaran: calculatedTotal,
        },
      });

      // 3. Loop melalui rincian dari frontend untuk membuat atau mengupdate (upsert)
      for (const rincianData of rincian) {
        await tx.spmRincian.upsert({
          where: { id: rincianData.id || -1 },
          create: {
            // ... (data create yang sudah ada)
            // 👇 --- PENAMBAHAN FIELD BARU --- 👇
            kodeKRO: rincianData.kodeKRO,
            kodeRO: rincianData.kodeRO,
            kodeKomponen: rincianData.kodeKomponen,
            kodeSubkomponen: rincianData.kodeSubkomponen,
            uraian: rincianData.uraian,
          },
          update: {
            // ... (data update yang sudah ada)
            // 👇 --- PENAMBAHAN FIELD BARU --- 👇
            kodeKRO: rincianData.kodeKRO,
            kodeRO: rincianData.kodeRO,
            kodeKomponen: rincianData.kodeKomponen,
            kodeSubkomponen: rincianData.kodeSubkomponen,
            uraian: rincianData.uraian,
          },
        });
      }

      // Ambil data SPM terbaru dengan semua relasinya
      return tx.spm.findUnique({
        where: { id: parseInt(id) },
        include: {
          rincian: { include: { jawabanFlags: true, kodeAkun: true } },
        },
      });
    });

    res.status(200).json(updatedSpm);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengupdate SPM.' });
  }
};

// @desc    Menghapus SPM
// @route   DELETE /api/spm/:id
// @access  Private
exports.deleteSpm = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.spm.delete({
      where: { id: parseInt(id) },
    });

    // onDelete: Cascade di schema akan otomatis menghapus semua rincian terkait
    res.status(200).json({ message: 'SPM berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    // Tangani jika SPM tidak ditemukan
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    res.status(500).json({ error: 'Gagal menghapus SPM.' });
  }
};
