const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// @desc    Membuat SPM baru beserta semua rinciannya
// @route   POST /api/spm
// @access  Private (setelah login)
exports.createSpmWithRincian = async (req, res) => {
  try {
    const {
      nomorSpm,
      tahunAnggaran,
      tanggal,
      satkerId,
      rincian, // Frontend mengirim array of rincian objects
    } = req.body;

    // Pastikan ada data rincian yang dikirim
    if (!rincian || rincian.length === 0) {
      return res
        .status(400)
        .json({ error: 'SPM harus memiliki setidaknya satu rincian.' });
    }

    const newSpm = await prisma.spm.create({
      data: {
        // Data SPM Utama
        nomorSpm,
        tahunAnggaran,
        tanggal: new Date(tanggal),
        satker: { connect: { id: satkerId } },

        // Buat semua rincian terkait secara bersamaan
        rincian: {
          create: rincian.map((r) => ({
            kodeProgram: r.kodeProgram,
            kodeKegiatan: r.kodeKegiatan,
            jumlah: r.jumlah,
            kodeAkun: { connect: { id: r.kodeAkunId } },
            jawabanFlags: {
              create: r.jawabanFlags,
            },
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
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat SPM beserta rinciannya.' });
  }
};

// @desc    Mendapatkan semua SPM (data ringkas untuk list)
// @route   GET /api/spm
// @access  Private
exports.getAllSpms = async (req, res) => {
  try {
    const spms = await prisma.spm.findMany({
      orderBy: {
        tanggal: 'desc', // Tampilkan yang terbaru di atas
      },
      include: {
        satker: {
          select: { nama: true }, // Hanya ambil nama satker
        },
        _count: {
          select: { rincian: true }, // Hitung jumlah rincian
        },
      },
    });
    res.status(200).json(spms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil daftar SPM.' });
  }
};

// @desc    Mendapatkan detail satu SPM berdasarkan ID
// @route   GET /api/spm/:id
// @access  Private
// desc    Mendapatkan detail satu SPM berdasarkan ID (dengan persentase kelengkapan)
// @route   GET /api/spm/:id
// @access  Private
exports.getSpmById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Ambil data SPM dan relasinya seperti biasa
    const spm = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
      include: {
        satker: true,
        rincian: {
          include: {
            kodeAkun: true,
            jawabanFlags: true,
          },
        },
      },
    });

    if (!spm) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    // 2. Loop melalui setiap rincian untuk menghitung persentasenya
    for (const rincian of spm.rincian) {
      // Dapatkan Denominator: Total flag yang dibutuhkan untuk KodeAkun ini
      const totalRequiredFlags = await prisma.flag.count({
        where: { kodeAkunId: rincian.kodeAkunId },
      });

      // Dapatkan Numerator: Total jawaban 'IYA' untuk rincian ini
      const totalJawabanIya = await prisma.jawabanFlag.count({
        where: {
          rincianSpmId: rincian.id,
          tipe: 'IYA',
        },
      });

      // Hitung persentase (hindari pembagian dengan nol)
      let persentase = 0;
      if (totalRequiredFlags > 0) {
        persentase = (totalJawabanIya / totalRequiredFlags) * 100;
      }

      // 3. Sisipkan properti baru 'persentaseKelengkapan' ke objek rincian
      rincian.persentaseKelengkapan = persentase; // Dibulatkan
    }

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
        data: { nomorSpm, tahunAnggaran, tanggal: new Date(tanggal), satkerId },
      });

      // 3. Loop melalui rincian dari frontend untuk membuat atau mengupdate (upsert)
      for (const rincianData of rincian) {
        await tx.spmRincian.upsert({
          where: { id: rincianData.id || -1 },
          create: {
            spmId: spm.id,
            kodeProgram: rincianData.kodeProgram,
            kodeKegiatan: rincianData.kodeKegiatan,
            jumlah: rincianData.jumlah,
            kodeAkunId: rincianData.kodeAkunId,
            jawabanFlags: { create: rincianData.jawabanFlags },
          },
          update: {
            kodeProgram: rincianData.kodeProgram,
            kodeKegiatan: rincianData.kodeKegiatan,
            jumlah: rincianData.jumlah,
            kodeAkunId: rincianData.kodeAkunId,
            jawabanFlags: {
              deleteMany: {},
              create: rincianData.jawabanFlags,
            },
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
