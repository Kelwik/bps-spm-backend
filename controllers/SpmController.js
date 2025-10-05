const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- FUNGSI HELPER UNTUK KALKULASI PERSENTASE RINCIAN ---
async function calculateRincianPercentage(rincian) {
  // Pastikan jawabanFlags ada untuk kalkulasi
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

// @desc    Mendapatkan semua SPM (dengan filter peran dan kalkulasi persentase)
// @route   GET /api/spm
exports.getAllSpms = async (req, res) => {
  try {
    // --- PERUBAHAN DIMULAI DI SINI ---
    const { satkerId, tahun } = req.query; // Ambil satkerId & tahun dari query params
    const whereClause = {};

    // 1. Terapkan filter TAHUN ANGGARAN jika ada
    if (tahun) {
      whereClause.tahunAnggaran = parseInt(tahun, 10);
    }

    // 2. Terapkan filter SATKER berdasarkan peran user dan query param
    if (req.user.role === 'op_satker') {
      // Jika user adalah op_satker, paksa filter berdasarkan satkerId mereka
      whereClause.satkerId = req.user.satkerId;
    } else if (satkerId) {
      // Jika user adalah op_prov/supervisor dan memilih satker spesifik
      whereClause.satkerId = parseInt(satkerId, 10);
    }
    // Jika user adalah op_prov dan tidak memilih satker, whereClause.satkerId kosong
    // sehingga akan mengambil data dari semua satker (sesuai harapan).

    // --- AKHIR PERUBAHAN ---

    const spms = await prisma.spm.findMany({
      where: whereClause, // Gunakan whereClause yang sudah difilter
      orderBy: {
        tanggal: 'desc',
      },
      include: {
        satker: { select: { nama: true } },
        rincian: {
          include: {
            jawabanFlags: true,
          },
        },
      },
    });

    // Kalkulasi persentase (logika ini sudah benar dan tidak perlu diubah)
    await Promise.all(
      spms.map(async (spm) => {
        spm._count = { rincian: spm.rincian.length };
        if (spm.rincian.length === 0) {
          spm.completenessPercentage = 100;
        } else {
          const percentages = await Promise.all(
            spm.rincian.map((rincian) => calculateRincianPercentage(rincian))
          );
          const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
          spm.completenessPercentage = Math.round(
            totalPercentage / spm.rincian.length
          );
        }
        delete spm.rincian;
      })
    );

    res.status(200).json(spms);
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL SPMS ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar SPM.' });
  }
};

// @desc    Mendapatkan detail satu SPM
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
            jawabanFlags: true,
          },
        },
      },
    });

    if (!spm) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    if (req.user.role === 'op_satker' && spm.satkerId !== req.user.satkerId) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

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
exports.updateSpm = async (req, res) => {
  const { id } = req.params;
  const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian } = req.body;

  try {
    const spmToUpdate = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
    });
    if (!spmToUpdate) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    if (
      req.user.role === 'op_satker' &&
      spmToUpdate.satkerId !== req.user.satkerId
    ) {
      return res.status(403).json({
        error:
          'Akses ditolak. Anda tidak memiliki izin untuk mengedit SPM ini.',
      });
    }

    if (spmToUpdate.status === 'DITERIMA') {
      return res.status(403).json({
        error: 'Akses ditolak. SPM yang sudah diterima tidak dapat diubah.',
      });
    }
    if (
      req.user.role === 'op_satker' &&
      !['MENUNGGU', 'DITOLAK'].includes(spmToUpdate.status)
    ) {
      return res
        .status(403)
        .json({ error: 'Akses ditolak. SPM ini tidak dapat diubah lagi.' });
    }

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

    await prisma.$transaction(async (tx) => {
      if (rincianToDeleteIds.length > 0) {
        await tx.jawabanFlag.deleteMany({
          where: { rincianSpmId: { in: rincianToDeleteIds } },
        });
        await tx.spmRincian.deleteMany({
          where: { id: { in: rincianToDeleteIds } },
        });
      }

      const dataToUpdate = {
        nomorSpm,
        tahunAnggaran: parseInt(tahunAnggaran),
        tanggal: new Date(tanggal),
        satkerId: parseInt(satkerId),
        totalAnggaran: calculatedTotal,
      };

      if (spmToUpdate.status === 'DITOLAK') {
        dataToUpdate.status = 'MENUNGGU';
      }

      const spm = await tx.spm.update({
        where: { id: parseInt(id) },
        data: dataToUpdate,
      });

      for (const rincianData of rincian) {
        const {
          id: rincianId,
          kodeAkunId,
          jawabanFlags,
          ...restOfData
        } = rincianData;
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
            jawabanFlags: { deleteMany: {}, create: cleanJawabanFlags },
          },
        });
      }
    });

    res.status(200).json({ message: 'SPM berhasil diupdate.' });
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
exports.deleteSpm = async (req, res) => {
  try {
    const { id } = req.params;

    const spmToDelete = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
    });
    if (!spmToDelete) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    if (
      req.user.role === 'op_satker' &&
      spmToDelete.satkerId !== req.user.satkerId
    ) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    if (spmToDelete.status === 'DITERIMA') {
      return res
        .status(403)
        .json({ error: 'SPM yang sudah diterima tidak dapat dihapus.' });
    }

    await prisma.spm.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: 'SPM berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    res.status(500).json({ error: 'Gagal menghapus SPM.' });
  }
};

// @desc    Mengubah status SPM
exports.updateSpmStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['op_prov', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  if (!status || !['DITERIMA', 'DITOLAK', 'MENUNGGU'].includes(status)) {
    return res.status(400).json({ error: 'Status yang dikirim tidak valid.' });
  }

  try {
    const updatedSpm = await prisma.spm.update({
      where: { id: parseInt(id) },
      data: { status: status },
    });
    res.status(200).json(updatedSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR UPDATE STATUS ---', error);
    res.status(500).json({ error: 'Gagal memperbarui status SPM.' });
  }
};
