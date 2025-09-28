const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function calculateRincianPercentage(rincian) {
  const totalRequiredFlags = await prisma.flag.count({
    where: { kodeAkunId: rincian.kodeAkunId },
  });
  if (totalRequiredFlags === 0) return 100;
  // Kalkulasi ini efisien karena jawabanFlags sudah di-include
  const totalJawabanIya = rincian.jawabanFlags.filter(
    (flag) => flag.tipe === 'IYA'
  ).length;
  return Math.round((totalJawabanIya / totalRequiredFlags) * 100);
}

// @desc    Membuat SPM baru beserta semua rinciannya
exports.createSpmWithRincian = async (req, res) => {
  try {
    const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian } = req.body;
    if (!rincian || rincian.length === 0) {
      return res
        .status(400)
        .json({ error: 'SPM harus memiliki setidaknya satu rincian.' });
    }
    const calculatedTotal = rincian.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0
    );
    const newSpm = await prisma.spm.create({
      data: {
        nomorSpm,
        tahunAnggaran: parseInt(tahunAnggaran),
        tanggal: new Date(tanggal),
        totalAnggaran: calculatedTotal,
        satker: { connect: { id: parseInt(satkerId) } },
        rincian: {
          create: rincian.map((r) => ({
            kodeProgram: r.kodeProgram,
            kodeKegiatan: r.kodeKegiatan,
            jumlah: parseInt(r.jumlah),
            kodeAkun: { connect: { id: parseInt(r.kodeAkunId) } },
            // --- PERBAIKAN DI SINI ---
            // Ambil hanya 'nama' dan 'tipe' dari jawabanFlags
            jawabanFlags: {
              create: r.jawabanFlags.map(({ nama, tipe }) => ({ nama, tipe })),
            },
            kodeKRO: r.kodeKRO,
            kodeRO: r.kodeRO,
            kodeKomponen: r.kodeKomponen,
            kodeSubkomponen: r.kodeSubkomponen,
            uraian: r.uraian,
          })),
        },
      },
      include: { rincian: { include: { jawabanFlags: true } } },
    });
    res.status(201).json(newSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR PEMBUATAN SPM ---', error);
    if (error.code === 'P2002') {
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
    const calculatedTotal = rincian.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0
    );
    const existingRincian = await prisma.spmRincian.findMany({
      where: { spmId: parseInt(id) },
      select: { id: true },
    });
    const existingRincianIds = existingRincian.map((r) => r.id);
    const incomingRincianIds = rincian.filter((r) => r.id).map((r) => r.id);
    const rincianToDeleteIds = existingRincianIds.filter(
      (existingId) => !incomingRincianIds.includes(existingId)
    );

    const updatedSpm = await prisma.$transaction(async (tx) => {
      if (rincianToDeleteIds.length > 0) {
        await tx.jawabanFlag.deleteMany({
          where: { rincianSpmId: { in: rincianToDeleteIds } },
        });
        await tx.spmRincian.deleteMany({
          where: { id: { in: rincianToDeleteIds } },
        });
      }

      const spm = await tx.spm.update({
        where: { id: parseInt(id) },
        data: {
          nomorSpm,
          tahunAnggaran: parseInt(tahunAnggaran),
          tanggal: new Date(tanggal),
          satkerId: parseInt(satkerId),
          totalAnggaran: calculatedTotal,
        },
      });

      for (const rincianData of rincian) {
        const {
          id: rincianId,
          kodeAkunId,
          jawabanFlags,
          ...restOfData
        } = rincianData;

        // --- PERBAIKAN DI SINI JUGA ---
        // Siapkan data jawabanFlags yang bersih
        const cleanJawabanFlags = jawabanFlags.map(({ nama, tipe }) => ({
          nama,
          tipe,
        }));

        await tx.spmRincian.upsert({
          where: { id: rincianId || -1 },
          create: {
            ...restOfData,
            jumlah: parseInt(restOfData.jumlah) || 0,
            spm: { connect: { id: spm.id } },
            kodeAkun: { connect: { id: parseInt(kodeAkunId) } },
            jawabanFlags: { create: cleanJawabanFlags },
          },
          update: {
            ...restOfData,
            jumlah: parseInt(restOfData.jumlah) || 0,
            kodeAkun: { connect: { id: parseInt(kodeAkunId) } },
            jawabanFlags: {
              deleteMany: {},
              create: cleanJawabanFlags,
            },
          },
        });
      }

      return tx.spm.findUnique({
        where: { id: parseInt(id) },
        include: {
          rincian: { include: { jawabanFlags: true, kodeAkun: true } },
        },
      });
    });

    res.status(200).json(updatedSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR UPDATE SPM ---', error);
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: `Nomor SPM '${req.body.nomorSpm}' sudah terdaftar.` });
    }
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
