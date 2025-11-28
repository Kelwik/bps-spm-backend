// controllers/SpmController.js

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

// @desc    Membuat SPM baru dengan Rincian
// @route   POST /api/spm
exports.createSpmWithRincian = async (req, res) => {
  // --- SECURITY CHECK: Viewers cannot create SPMs ---
  if (req.user.role === 'viewer') {
    return res
      .status(403)
      .json({ error: 'Akses ditolak. Viewer tidak dapat membuat data.' });
  }

  try {
    const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian, driveLink } =
      req.body;

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
        driveLink: driveLink,
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

// @desc    Mendapatkan semua SPM (dengan filter & pagination)
// @route   GET /api/spm
exports.getAllSpms = async (req, res) => {
  try {
    const { satkerId, tahun, page, limit } = req.query;

    const applyPagination = page && limit;
    const pageNum = applyPagination ? parseInt(page) : 1;
    const limitNum = applyPagination ? parseInt(limit) : undefined;
    const skip = applyPagination ? (pageNum - 1) * limitNum : 0;

    const whereClause = {};
    if (tahun) {
      whereClause.tahunAnggaran = parseInt(tahun, 10);
    }
    if (req.user.role === 'op_satker') {
      whereClause.satkerId = req.user.satkerId;
    } else if (satkerId) {
      whereClause.satkerId = parseInt(satkerId, 10);
    }

    const [spms, totalSpms] = await prisma.$transaction([
      prisma.spm.findMany({
        where: whereClause,
        skip: applyPagination ? skip : undefined,
        take: limitNum,
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
      }),
      prisma.spm.count({ where: whereClause }),
    ]);

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

    res.status(200).json({
      spms,
      totalCount: totalSpms,
      totalPages: applyPagination ? Math.ceil(totalSpms / limitNum) : 1,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL SPMS ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar SPM.' });
  }
};

// @desc    Mendapatkan detail satu SPM
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

// @desc    Update SPM
// @route   PUT /api/spm/:id
exports.updateSpm = async (req, res) => {
  const { id } = req.params;

  if (req.user.role === 'viewer') {
    return res
      .status(403)
      .json({ error: 'Akses ditolak. Viewer tidak dapat mengubah data.' });
  }

  const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian, driveLink } =
    req.body;

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
        driveLink: driveLink,
      };

      if (spmToUpdate.status === 'DITOLAK') {
        dataToUpdate.status = 'MENUNGGU';
        dataToUpdate.rejectionComment = null;
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
// @route   DELETE /api/spm/:id
exports.deleteSpm = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'viewer') {
      return res
        .status(403)
        .json({ error: 'Akses ditolak. Viewer tidak dapat menghapus data.' });
    }

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

// @desc    Update Status SPM
// @route   PATCH /api/spm/:id/status
exports.updateSpmStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comment } = req.body;

  if (!['op_prov', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  if (!status || !['DITERIMA', 'DITOLAK'].includes(status)) {
    return res.status(400).json({ error: 'Status yang dikirim tidak valid.' });
  }

  try {
    const dataToUpdate = { status: status };

    if (status === 'DITOLAK') {
      dataToUpdate.rejectionComment = comment || null;
    } else {
      dataToUpdate.rejectionComment = null;
    }

    const updatedSpm = await prisma.spm.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });
    res.status(200).json(updatedSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR UPDATE STATUS ---', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    res.status(500).json({ error: 'Gagal memperbarui status SPM.' });
  }
};

// @desc    Validasi Laporan SAKTI (WITHOUT PAGU)
// @route   POST /api/spm/validate-report
exports.validateSaktiReport = async (req, res) => {
  const { data: reportRows } = req.body;
  const { tahun, satkerId } = req.query; // GET satkerId from query

  if (!reportRows || !Array.isArray(reportRows)) {
    return res.status(400).json({ error: 'Data laporan tidak valid.' });
  }
  const validationYear = parseInt(tahun);
  if (isNaN(validationYear)) {
    return res
      .status(400)
      .json({ error: 'Parameter tahun anggaran tidak valid.' });
  }

  let targetSatkerId = null;
  if (req.user.role === 'op_satker') {
    targetSatkerId = req.user.satkerId;
  } else {
    if (!satkerId) {
      return res
        .status(400)
        .json({ error: 'Harap pilih Satuan Kerja spesifik untuk validasi.' });
    }
    targetSatkerId = parseInt(satkerId);
  }

  try {
    const saktiData = {};
    let currentKodeAkun = '';

    for (const row of reportRows) {
      // Kode Akun in column H (index 7)
      if (row[7] && /^\d{6}$/.test(String(row[7]).trim())) {
        currentKodeAkun = String(row[7]).trim();
      }
      // Detailed Uraian in column N (index 13)
      if (row[13] && /^\d{6}\./.test(String(row[13]).trim())) {
        const uraian = String(row[13])
          .replace(/^\d{6}\.\s*/, '')
          .trim();

        // --- ONLY REALISASI (Index 25/Col Z) ---
        const realisasi = parseInt(row[25], 10) || 0;

        if (!saktiData[currentKodeAkun]) {
          saktiData[currentKodeAkun] = [];
        }
        saktiData[currentKodeAkun].push({ uraian, realisasi });
      }
    }

    const rincianInDb = await prisma.spmRincian.findMany({
      where: {
        spm: {
          tahunAnggaran: validationYear,
          satkerId: targetSatkerId,
        },
      },
      include: {
        kodeAkun: true,
        spm: { select: { nomorSpm: true } },
      },
      orderBy: [
        { spm: { nomorSpm: 'asc' } },
        { kodeAkun: { kode: 'asc' } },
        { uraian: 'asc' },
      ],
    });

    let results = [];
    for (const rincian of rincianInDb) {
      const saktiItems = saktiData[rincian.kodeAkun.kode];
      let status = 'NOT_FOUND';
      let saktiAmount = null;
      let difference = null;

      if (saktiItems) {
        const matchedItem = saktiItems.find(
          (item) =>
            item.uraian.toLowerCase().trim() ===
            rincian.uraian.toLowerCase().trim()
        );

        if (matchedItem) {
          saktiAmount = matchedItem.realisasi;
          difference = rincian.jumlah - saktiAmount;
          status = difference === 0 ? 'MATCH' : 'MISMATCH';
        }
      }

      results.push({
        spmNomor: rincian.spm.nomorSpm,
        kodeAkun: rincian.kodeAkun.kode,
        kodeAkunNama: rincian.kodeAkun.nama,
        rincianUraian: rincian.uraian,
        appAmount: rincian.jumlah,
        saktiAmount,
        difference,
        status,
      });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('--- ERROR VALIDATING SAKTI REPORT ---', error);
    res.status(500).json({ error: 'Gagal memvalidasi laporan SAKTI.' });
  }
};
