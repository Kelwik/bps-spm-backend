// controllers/SpmController.js

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const ExcelJS = require('exceljs');

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

// @desc    Download Template Excel (Updated with Dark Mode & Drive Link)
// @route   GET /api/spm/template
exports.downloadImportTemplate = async (req, res) => {
  try {
    // 1. Fetch Data
    const allFlags = await prisma.flag.findMany({
      distinct: ['nama'],
      orderBy: { nama: 'asc' },
      select: { nama: true },
    });

    const allKodeAkun = await prisma.kodeAkun.findMany({
      include: { templateFlags: true },
      orderBy: { kode: 'asc' },
    });

    const flagNames = allFlags.map((f) => f.nama);
    const workbook = new ExcelJS.Workbook();

    // --- SHEET 0: PETUNJUK (INSTRUCTIONS) ---
    const guideSheet = workbook.addWorksheet('Petunjuk');
    guideSheet.addRows([
      ['PANDUAN PENGISIAN'],
      [''],
      ['1. FIELD BARU'],
      ['   - Kolom "Link Google Drive" (Kolom C) sekarang tersedia.'],
      [''],
      ['2. PANDUAN WARNA (VISUAL)'],
      ['   - KOTAK PUTIH: Boleh diisi (Dokumen ini relevan).'],
      ['   - KOTAK GELAP (HITAM): TIDAK PERLU DIISI (Dokumen tidak relevan).'],
      [''],
      ['3. FORMAT PENGISIAN'],
      ['   - Pilih "Kode Akun" dulu di Kolom F agar warna berubah otomatis.'],
      ['   - Isi kolom dokumen dengan "IYA" atau angka "1".'],
    ]);

    // --- SHEET 1: INPUT DATA ---
    const worksheet = workbook.addWorksheet('Input Data');

    // Updated Headers (Added Link Google Drive)
    const staticHeaders = [
      'Nomor SPM',
      'Tanggal (YYYY-MM-DD)',
      'Link Google Drive', // <--- NEW COLUMN
      'Kode Program',
      'Kode Kegiatan',
      'Kode Akun',
      'Kode KRO',
      'Kode RO',
      'Kode Komponen',
      'Kode Subkomponen',
      'Uraian',
      'Jumlah',
    ];

    // Setup Columns
    worksheet.columns = [
      ...staticHeaders.map((h) => ({
        header: h,
        key: h.replace(/\s/g, ''),
        width: 22,
      })),
      ...flagNames.map((f) => ({ header: f, key: f, width: 18 })),
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF002B6A' },
    };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    headerRow.height = 40; // Taller header for readability

    // --- SHEET 2: REFERENCE (Hidden) ---
    const refSheet = workbook.addWorksheet('Reference');
    refSheet.state = 'hidden';
    refSheet.getRow(1).values = ['KodeAkun', ...flagNames];

    allKodeAkun.forEach((akun) => {
      // Ensure kode is treated as string to avoid MATCH errors
      const rowData = [akun.kode.toString()];
      flagNames.forEach((flagName) => {
        const isRequired = akun.templateFlags.some(
          (tf) => tf.nama === flagName
        );
        rowData.push(isRequired ? 'REQ' : 'NA');
      });
      refSheet.addRow(rowData);
    });

    const kodeAkunRange = `Reference!$A$2:$A$${allKodeAkun.length + 1}`;

    // --- APPLY STYLES TO ROWS 2-500 ---
    const totalColumns = staticHeaders.length + flagNames.length;

    for (let i = 2; i <= 500; i++) {
      const row = worksheet.getRow(i);

      // 1. STANDARD BORDERS (Black thin border)
      // This ensures white cells look like proper input boxes
      for (let j = 1; j <= totalColumns; j++) {
        row.getCell(j).border = {
          top: { style: 'thin', color: { argb: 'FF999999' } },
          left: { style: 'thin', color: { argb: 'FF999999' } },
          bottom: { style: 'thin', color: { argb: 'FF999999' } },
          right: { style: 'thin', color: { argb: 'FF999999' } },
        };
      }

      // 2. Data Validation for Kode Akun (Column F / Index 6)
      row.getCell(6).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [kodeAkunRange],
      };
    }

    // --- CONDITIONAL FORMATTING (High Contrast Blackout) ---
    const startFlagColIndex = staticHeaders.length + 1; // Column M (13)

    flagNames.forEach((flag, index) => {
      const colLetter = worksheet.getColumn(startFlagColIndex + index).letter;
      const refColLetter = refSheet.getColumn(index + 2).letter;

      // Validation Dropdown
      for (let r = 2; r <= 500; r++) {
        worksheet.getCell(`${colLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"IYA,TIDAK"'],
        };
      }

      // Formatting Rule: If Matrix says "NA" -> BLACK OUT
      // Using 'lightDown' pattern (diagonal stripes) + Dark Grey Background
      worksheet.addConditionalFormatting({
        ref: `${colLetter}2:${colLetter}500`,
        rules: [
          {
            type: 'expression',
            // Logic: If Kode Akun matches and flag is "NA"
            formulae: [
              `INDEX(Reference!$${refColLetter}$2:$${refColLetter}$999, MATCH($F2, Reference!$A$2:$A$999, 0))="NA"`,
            ],
            style: {
              fill: {
                type: 'pattern',
                pattern: 'lightDown', // Striped pattern
                fgColor: { argb: 'FFCCCCCC' }, // Light stripes
                bgColor: { argb: 'FF333333' }, // Dark Grey background
              },
              font: {
                color: { argb: 'FF555555' }, // Dim text
              },
            },
          },
        ],
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Template_Import_SPM_v4.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Gagal membuat template Excel.' });
  }
};

// @desc    Import Bulk SPM (Updated for GDrive & Columns)
// @route   POST /api/spm/import
exports.importSpms = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: 'File Excel wajib diunggah.' });

  let satkerId = req.body.satkerId;
  if (req.user.role === 'op_satker') satkerId = req.user.satkerId;
  if (!satkerId)
    return res.status(400).json({ error: 'Satker ID tidak valid.' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet =
      workbook.getWorksheet('Input Data') ||
      workbook.worksheets[1] ||
      workbook.worksheets[0];

    const spmGroups = {};
    const allKodeAkun = await prisma.kodeAkun.findMany();

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      // Column 1: Nomor SPM
      const nomorSpm = row.getCell(1).text?.trim();
      if (!nomorSpm) return;

      // Column 2: Tanggal
      const tanggalVal = row.getCell(2).value;
      const tanggal = new Date(tanggalVal);

      // Column 3: Google Drive Link (NEW)
      const driveLink = row.getCell(3).text?.trim();

      // Columns 4-12: Rincian Details
      const kodeProgram = row.getCell(4).text;
      const kodeKegiatan = row.getCell(5).text;
      const kodeAkunKode = row.getCell(6).text;
      const kodeKRO = row.getCell(7).text;
      const kodeRO = row.getCell(8).text;
      const kodeKomponen = row.getCell(9).text;
      const kodeSubkomponen = row.getCell(10).text;
      const uraian = row.getCell(11).text;
      const jumlah = parseFloat(row.getCell(12).value) || 0;

      // Grouping Logic
      if (!spmGroups[nomorSpm]) {
        spmGroups[nomorSpm] = {
          nomorSpm,
          driveLink, // Save Drive Link
          tanggal: isNaN(tanggal) ? new Date() : tanggal,
          tahunAnggaran: isNaN(tanggal)
            ? new Date().getFullYear()
            : tanggal.getFullYear(),
          satkerId: parseInt(satkerId),
          rincian: [],
        };
      }

      // Flags start at Column 13 (M)
      const flagCells = {};
      row.eachCell((cell, colNumber) => {
        if (colNumber >= 13) {
          const headerCell = worksheet.getRow(1).getCell(colNumber);
          const flagName = headerCell.text;

          // Cleaner Input Logic
          const valStr = cell.text
            ? cell.text.toString().toUpperCase().trim()
            : 'TIDAK';
          const cleanValue = ['YA', 'IYA', 'ADA', '1', 'TRUE', 'V'].includes(
            valStr
          )
            ? 'IYA'
            : 'TIDAK';

          if (flagName) {
            flagCells[flagName] = cleanValue;
          }
        }
      });

      spmGroups[nomorSpm].rincian.push({
        kodeProgram,
        kodeKegiatan,
        kodeAkunKode,
        kodeKRO,
        kodeRO,
        kodeKomponen,
        kodeSubkomponen,
        uraian,
        jumlah,
        flags: flagCells,
      });
    });

    // Transaction Save
    await prisma.$transaction(async (tx) => {
      for (const spmKey in spmGroups) {
        const spmData = spmGroups[spmKey];
        const totalAnggaran = spmData.rincian.reduce(
          (sum, item) => sum + item.jumlah,
          0
        );

        const newSpm = await tx.spm.create({
          data: {
            nomorSpm: spmData.nomorSpm,
            tahunAnggaran: spmData.tahunAnggaran,
            tanggal: spmData.tanggal,
            satkerId: spmData.satkerId,
            totalAnggaran: totalAnggaran,
            driveLink: spmData.driveLink,
            status: 'MENUNGGU',
          },
        });

        for (const item of spmData.rincian) {
          // Robust Kode Akun matching (String vs String)
          const akunDb = allKodeAkun.find(
            (k) => k.kode.toString() === item.kodeAkunKode.toString()
          );

          if (!akunDb) {
            throw new Error(
              `Kode Akun '${item.kodeAkunKode}' (SPM: ${spmData.nomorSpm}) tidak ditemukan di database.`
            );
          }

          const newRincian = await tx.spmRincian.create({
            data: {
              spmId: newSpm.id,
              kodeAkunId: akunDb.id,
              kodeProgram: item.kodeProgram || '-',
              kodeKegiatan: item.kodeKegiatan || '-',
              kodeKRO: item.kodeKRO || '-',
              kodeRO: item.kodeRO || '-',
              kodeKomponen: item.kodeKomponen || '-',
              kodeSubkomponen: item.kodeSubkomponen || '-',
              uraian: item.uraian || '-',
              jumlah: item.jumlah,
            },
          });

          const flagData = Object.entries(item.flags).map(([nama, val]) => ({
            rincianSpmId: newRincian.id,
            nama: nama,
            tipe: val,
          }));

          if (flagData.length > 0) {
            await tx.jawabanFlag.createMany({ data: flagData });
          }
        }
      }
    });

    res.status(200).json({
      message: `Berhasil mengimpor ${Object.keys(spmGroups).length} SPM!`,
    });
  } catch (error) {
    console.error('Import Error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Salah satu Nomor SPM dalam file sudah ada di sistem.',
      });
    }
    res
      .status(500)
      .json({ error: error.message || 'Gagal memproses file import.' });
  }
};
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
  const { tahun, satkerId } = req.query;

  if (!reportRows || !Array.isArray(reportRows))
    return res.status(400).json({ error: 'Data laporan tidak valid.' });

  let targetSatkerId = null;
  if (req.user.role === 'op_satker') targetSatkerId = req.user.satkerId;
  else if (satkerId) targetSatkerId = parseInt(satkerId);
  else return res.status(400).json({ error: 'Harap pilih Satuan Kerja.' });

  try {
    const saktiData = {};
    let currentKodeAkun = ''; // Variable persists across loop iterations!

    for (const row of reportRows) {
      // 1. Detect Header Row with Kode Akun (Column H / Index 7)
      if (row[7] && /^\d{6}$/.test(String(row[7]).trim())) {
        currentKodeAkun = String(row[7]).trim();
      }

      // 2. Detect Detail Row (Column N / Index 13) and use the LAST SEEN Kode Akun
      if (
        currentKodeAkun &&
        row[13] &&
        /^\d{6}\./.test(String(row[13]).trim())
      ) {
        const uraian = String(row[13])
          .replace(/^\d{6}\.\s*/, '')
          .trim();
        const realisasi = parseInt(row[25], 10) || 0; // Column Z (Index 25)

        if (!saktiData[currentKodeAkun]) saktiData[currentKodeAkun] = [];
        saktiData[currentKodeAkun].push({ uraian, realisasi });
      }
    }

    const rincianInDb = await prisma.spmRincian.findMany({
      where: {
        spm: { tahunAnggaran: parseInt(tahun), satkerId: targetSatkerId },
      },
      include: { kodeAkun: true, spm: { select: { nomorSpm: true } } },
    });

    let results = [];
    for (const rincian of rincianInDb) {
      const saktiItems = saktiData[rincian.kodeAkun.kode];
      let status = 'NOT_FOUND';
      let saktiAmount = null;
      let difference = null;

      if (saktiItems) {
        // Relaxed Matching: Trim and Lowercase
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
        // Detailed Codes
        kodeProgram: rincian.kodeProgram,
        kodeKegiatan: rincian.kodeKegiatan,
        kodeKRO: rincian.kodeKRO,
        kodeRO: rincian.kodeRO,
        kodeKomponen: rincian.kodeKomponen,
        kodeSubkomponen: rincian.kodeSubkomponen,
        // Standard info
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
    console.error('Validation Error:', error);
    res.status(500).json({ error: 'Gagal memvalidasi laporan SAKTI.' });
  }
};
