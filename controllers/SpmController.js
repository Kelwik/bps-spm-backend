// kelwik/bps-spm-backend/bps-spm-backend-400c9ff7c6a2167b8df29d46240ba24306466326/controllers/SpmController.js

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- FUNGSI HELPER UNTUK KALKULASI PERSENTASE RINCIAN ---
async function calculateRincianPercentage(rincian) {
  // Ensure jawabanFlags are loaded if not already included
  if (!rincian.jawabanFlags) {
    rincian.jawabanFlags = await prisma.jawabanFlag.findMany({
      where: { rincianSpmId: rincian.id },
    });
  }
  // Count required flags for the associated KodeAkun
  const totalRequiredFlags = await prisma.flag.count({
    where: { kodeAkunId: rincian.kodeAkunId },
  });
  // If no flags are required, completeness is 100%
  if (totalRequiredFlags === 0) return 100;
  // Count how many required flags have the answer 'IYA'
  const totalJawabanIya = rincian.jawabanFlags.filter(
    (flag) => flag.tipe === 'IYA'
  ).length;
  // Calculate and round the percentage
  return Math.round((totalJawabanIya / totalRequiredFlags) * 100);
}

exports.createSpmWithRincian = async (req, res) => {
  try {
    const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian, driveLink } =
      req.body;
    // Validate that rincian array exists and is not empty
    if (!rincian || rincian.length === 0) {
      return res
        .status(400)
        .json({ error: 'SPM harus memiliki setidaknya satu rincian.' });
    }
    // Calculate the total anggaran based on the sum of rincian amounts
    const calculatedTotal = rincian.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0
    );
    // Create the new SPM and its associated rincian in a transaction
    const newSpm = await prisma.spm.create({
      data: {
        nomorSpm,
        tahunAnggaran: parseInt(tahunAnggaran),
        tanggal: new Date(tanggal),
        totalAnggaran: calculatedTotal,
        driveLink: driveLink, // Save the G-Drive link provided in the request
        satker: { connect: { id: parseInt(satkerId) } }, // Link to the Satker
        // Create multiple SpmRincian records
        rincian: {
          create: rincian.map((r) => ({
            kodeProgram: r.kodeProgram,
            kodeKegiatan: r.kodeKegiatan,
            jumlah: parseInt(r.jumlah),
            kodeAkun: { connect: { id: parseInt(r.kodeAkunId) } }, // Link to KodeAkun
            // Create associated JawabanFlag records for each rincian
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
      // Include the newly created rincian and their flags in the response
      include: { rincian: { include: { jawabanFlags: true } } },
    });
    // Respond with the created SPM data
    res.status(201).json(newSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR PEMBUATAN SPM ---', error);
    // Handle potential unique constraint violation (duplicate nomorSpm)
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: `Nomor SPM '${req.body.nomorSpm}' sudah terdaftar.` });
    }
    // Handle other errors
    res.status(500).json({ error: 'Gagal membuat SPM beserta rinciannya.' });
  }
};

// --- MODIFIED FUNCTION ---
exports.getAllSpms = async (req, res) => {
  try {
    // Get pagination/filter params, DO NOT set defaults here
    const { satkerId, tahun, page, limit } = req.query;

    // Determine if pagination should be applied based on presence of page and limit
    const applyPagination = page && limit;
    const pageNum = applyPagination ? parseInt(page) : 1; // Default to page 1 conceptually if not paginating
    const limitNum = applyPagination ? parseInt(limit) : undefined; // Use undefined for limit to fetch all if not paginating
    const skip = applyPagination ? (pageNum - 1) * limitNum : 0; // Skip 0 if not paginating

    // Build the where clause for filtering
    const whereClause = {};
    if (tahun) {
      whereClause.tahunAnggaran = parseInt(tahun, 10);
    }
    // Apply satker filter based on user role or query parameter
    if (req.user.role === 'op_satker') {
      whereClause.satkerId = req.user.satkerId; // Force filter for op_satker
    } else if (satkerId) {
      whereClause.satkerId = parseInt(satkerId, 10); // Apply filter if provided by admin/prov
    }

    // Fetch SPMs and total count in a single transaction
    const [spms, totalSpms] = await prisma.$transaction([
      prisma.spm.findMany({
        where: whereClause,
        // Conditionally apply skip and take for pagination
        skip: applyPagination ? skip : undefined, // Prisma handles undefined skip as 0
        take: limitNum, // Prisma handles undefined take as "fetch all"
        orderBy: {
          tanggal: 'desc', // Order results by date descending
        },
        // Include related data
        include: {
          satker: { select: { nama: true } }, // Include Satker name
          // Include rincian and their flags for completeness calculation
          rincian: {
            include: {
              jawabanFlags: true,
            },
          },
        },
      }),
      // Get the total count of SPMs matching the where clause (ignoring pagination)
      prisma.spm.count({ where: whereClause }),
    ]);

    // Calculate completeness percentage for each fetched SPM
    await Promise.all(
      spms.map(async (spm) => {
        // Add a count of rincian items to the SPM object
        spm._count = { rincian: spm.rincian.length };
        if (spm.rincian.length === 0) {
          spm.completenessPercentage = 100; // 100% if no rincian items
        } else {
          // Calculate percentage for each rincian item
          const percentages = await Promise.all(
            spm.rincian.map((rincian) => calculateRincianPercentage(rincian))
          );
          // Calculate the average percentage for the SPM
          const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
          spm.completenessPercentage = Math.round(
            totalPercentage / spm.rincian.length
          );
        }
        // Remove detailed rincian data from the response for list views to keep payload small
        delete spm.rincian;
      })
    );

    // Return the response object
    res.status(200).json({
      spms, // The array of SPMs (either a page or all)
      totalCount: totalSpms, // The total number of SPMs matching the filter
      // Calculate totalPages only if pagination was applied
      totalPages: applyPagination ? Math.ceil(totalSpms / limitNum) : 1,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL SPMS ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar SPM.' });
  }
};
// --- END OF MODIFIED FUNCTION ---

// @desc    Mendapatkan detail satu SPM by ID
exports.getSpmById = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the SPM by its ID
    const spm = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
      // Include related data needed for the detail view
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

    // Handle case where SPM is not found
    if (!spm) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    // Authorization check: op_satker can only view their own SPM
    if (req.user.role === 'op_satker' && spm.satkerId !== req.user.satkerId) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    // Calculate completeness percentage for each rincian item
    await Promise.all(
      spm.rincian.map(async (rincian) => {
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );
        // No need to delete jawabanFlags here as it's the detail view
      })
    );

    // Respond with the detailed SPM data
    res.status(200).json(spm);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data SPM.' });
  }
};

// @desc    Mengupdate SPM yang sudah ada
exports.updateSpm = async (req, res) => {
  const { id } = req.params;
  const { nomorSpm, tahunAnggaran, tanggal, satkerId, rincian, driveLink } =
    req.body;

  try {
    // Find the SPM to update
    const spmToUpdate = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
    });
    // Handle not found
    if (!spmToUpdate) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }

    // Authorization: op_satker can only edit their own SPMs
    if (
      req.user.role === 'op_satker' &&
      spmToUpdate.satkerId !== req.user.satkerId
    ) {
      return res.status(403).json({
        error:
          'Akses ditolak. Anda tidak memiliki izin untuk mengedit SPM ini.',
      });
    }

    // Prevent editing if SPM is already 'DITERIMA'
    if (spmToUpdate.status === 'DITERIMA') {
      return res.status(403).json({
        error: 'Akses ditolak. SPM yang sudah diterima tidak dapat diubah.',
      });
    }
    // Prevent op_satker from editing if status is not 'MENUNGGU' or 'DITOLAK'
    if (
      req.user.role === 'op_satker' &&
      !['MENUNGGU', 'DITOLAK'].includes(spmToUpdate.status)
    ) {
      return res
        .status(403)
        .json({ error: 'Akses ditolak. SPM ini tidak dapat diubah lagi.' });
    }

    // Recalculate total anggaran from the submitted rincian
    const calculatedTotal = rincian.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0
    );
    // Find existing rincian IDs for this SPM
    const existingRincian = await prisma.spmRincian.findMany({
      where: { spmId: parseInt(id) },
      select: { id: true },
    });
    const existingRincianIds = existingRincian.map((r) => r.id);
    // Get IDs of rincian submitted in the request that already exist (have an ID)
    const incomingRincianIds = rincian.filter((r) => r.id).map((r) => r.id);
    // Determine which existing rincian were removed in the frontend
    const rincianToDeleteIds = existingRincianIds.filter(
      (existingId) => !incomingRincianIds.includes(existingId)
    );

    // Perform updates within a transaction
    await prisma.$transaction(async (tx) => {
      // Delete flags and then the rincian items that were removed
      if (rincianToDeleteIds.length > 0) {
        await tx.jawabanFlag.deleteMany({
          where: { rincianSpmId: { in: rincianToDeleteIds } },
        });
        await tx.spmRincian.deleteMany({
          where: { id: { in: rincianToDeleteIds } },
        });
      }

      // Prepare data for updating the main SPM record
      const dataToUpdate = {
        nomorSpm,
        tahunAnggaran: parseInt(tahunAnggaran),
        tanggal: new Date(tanggal),
        satkerId: parseInt(satkerId), // Note: satkerId might not change in practice but included for completeness
        totalAnggaran: calculatedTotal,
        driveLink: driveLink, // Update the G-Drive link
      };

      // If the SPM was 'DITOLAK', reset its status to 'MENUNGGU' upon update
      if (spmToUpdate.status === 'DITOLAK') {
        dataToUpdate.status = 'MENUNGGU';
        dataToUpdate.rejectionComment = null; // Clear rejection comment
      }

      // Update the SPM record
      const spm = await tx.spm.update({
        where: { id: parseInt(id) },
        data: dataToUpdate,
      });

      // Upsert (update or insert) each rincian item
      for (const rincianData of rincian) {
        const {
          id: rincianId, // May be undefined for new items
          kodeAkunId,
          jawabanFlags,
          ...restOfData // Other rincian fields (jumlah, kodeProgram, etc.)
        } = rincianData;
        // Prepare jawabanFlags data for creation/update
        const cleanJawabanFlags = jawabanFlags.map(({ nama, tipe }) => ({
          nama,
          tipe,
        }));

        await tx.spmRincian.upsert({
          // Try to find by ID (negative ID ensures it won't match for creates)
          where: { id: rincianId || -1 },
          // Data for creating a new rincian item
          create: {
            ...restOfData,
            jumlah: parseInt(restOfData.jumlah) || 0,
            spm: { connect: { id: spm.id } }, // Link to parent SPM
            kodeAkun: { connect: { id: parseInt(kodeAkunId) } }, // Link to KodeAkun
            jawabanFlags: { create: cleanJawabanFlags }, // Create associated flags
          },
          // Data for updating an existing rincian item
          update: {
            ...restOfData,
            jumlah: parseInt(restOfData.jumlah) || 0,
            kodeAkun: { connect: { id: parseInt(kodeAkunId) } }, // Update KodeAkun link
            // Delete old flags and create new ones to ensure consistency
            jawabanFlags: { deleteMany: {}, create: cleanJawabanFlags },
          },
        });
      }
    });

    // Respond with success message
    res.status(200).json({ message: 'SPM berhasil diupdate.' });
  } catch (error) {
    console.error('--- DETAIL ERROR UPDATE SPM ---', error);
    // Handle potential unique constraint violation on nomorSpm
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: `Nomor SPM '${req.body.nomorSpm}' sudah terdaftar.` });
    }
    // Handle other errors
    res.status(500).json({ error: 'Gagal mengupdate SPM.' });
  }
};

// @desc    Menghapus SPM by ID
exports.deleteSpm = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the SPM to delete
    const spmToDelete = await prisma.spm.findUnique({
      where: { id: parseInt(id) },
    });
    // Handle not found
    if (!spmToDelete) {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    // Authorization: op_satker can only delete their own SPMs
    if (
      req.user.role === 'op_satker' &&
      spmToDelete.satkerId !== req.user.satkerId
    ) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    // Prevent deletion if SPM is already 'DITERIMA'
    if (spmToDelete.status === 'DITERIMA') {
      return res
        .status(403)
        .json({ error: 'SPM yang sudah diterima tidak dapat dihapus.' });
    }

    // Delete the SPM (cascading delete will handle rincian and flags)
    await prisma.spm.delete({
      where: { id: parseInt(id) },
    });

    // Respond with success message
    res.status(200).json({ message: 'SPM berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    // Handle case where the SPM might have been deleted between check and delete op
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    // Handle other errors
    res.status(500).json({ error: 'Gagal menghapus SPM.' });
  }
};

// @desc    Mengubah status SPM (DITERIMA/DITOLAK) - Admin only
exports.updateSpmStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comment } = req.body; // Status and optional comment

  // Authorization: Only op_prov or supervisor can change status
  if (!['op_prov', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  // Validate the incoming status
  if (!status || !['DITERIMA', 'DITOLAK'].includes(status)) {
    // Removed 'MENUNGGU' as it's handled by updateSpm
    return res.status(400).json({ error: 'Status yang dikirim tidak valid.' });
  }

  try {
    // Prepare data for update
    const dataToUpdate = { status: status };

    // Add rejection comment if status is 'DITOLAK'
    if (status === 'DITOLAK') {
      dataToUpdate.rejectionComment = comment || null; // Use null if comment is empty
    } else {
      // Ensure rejectionComment is cleared if status is changed to 'DITERIMA'
      dataToUpdate.rejectionComment = null;
    }

    // Update the SPM status and potentially the comment
    const updatedSpm = await prisma.spm.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });
    // Respond with the updated SPM data
    res.status(200).json(updatedSpm);
  } catch (error) {
    console.error('--- DETAIL ERROR UPDATE STATUS ---', error);
    // Handle case where SPM doesn't exist
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'SPM tidak ditemukan.' });
    }
    // Handle other errors
    res.status(500).json({ error: 'Gagal memperbarui status SPM.' });
  }
};

// @desc    Validate uploaded SAKTI report against DB data
exports.validateSaktiReport = async (req, res) => {
  const { data: reportRows } = req.body; // Expecting { data: [ [colA, colB, ...], ... ] }

  // Basic validation of the input structure
  if (!reportRows || !Array.isArray(reportRows)) {
    return res.status(400).json({ error: 'Data laporan tidak valid.' });
  }

  try {
    // --- PARSING THE SAKTI REPORT ---
    const saktiData = {}; // Object to store parsed data: { 'kodeAkun': [{ uraian, realisasi }, ...] }
    let currentKodeAkun = '';
    let currentYear = null; // To store the year detected from the report

    // Assuming the year might be mentioned early, e.g., in a header row
    // Look for a row that might contain the year (adjust logic if needed)
    for (const row of reportRows.slice(0, 10)) {
      // Check first few rows
      const yearMatch = String(row[0]).match(/TAHUN ANGGARAN\s*:\s*(\d{4})/i);
      if (yearMatch && yearMatch[1]) {
        currentYear = parseInt(yearMatch[1]);
        console.log(`Detected SAKTI Report Year: ${currentYear}`);
        break;
      }
    }

    if (!currentYear) {
      console.warn(
        'Could not detect year from SAKTI report header. Falling back to current system year or default.'
      );
      // Optionally use the 'tahunAnggaran' from the frontend context if available, or default
      currentYear = parseInt(req.query.tahun) || new Date().getFullYear(); // Or use a reliable source
      console.log(`Using year for DB query: ${currentYear}`);
    }

    // Process each row to extract Kode Akun, Uraian, and Realisasi
    for (const row of reportRows) {
      // Identify rows containing a 6-digit Kode Akun in column H (index 7)
      if (row[7] && /^\d{6}$/.test(String(row[7]).trim())) {
        currentKodeAkun = String(row[7]).trim();
      }
      // Identify rows containing detailed Uraian (starting with 6 digits and a dot) in column N (index 13)
      if (row[13] && /^\d{6}\./.test(String(row[13]).trim())) {
        // Extract the Uraian text, removing the leading code and dot
        const uraian = String(row[13])
          .replace(/^\d{6}\.\s*/, '')
          .trim();

        // Extract the "Realisasi s.d. Periode" amount from column W (index 22)
        const realisasi = parseInt(row[22], 10) || 0; // Default to 0 if parsing fails

        // Store the extracted data, grouped by Kode Akun
        if (!saktiData[currentKodeAkun]) {
          saktiData[currentKodeAkun] = [];
        }
        saktiData[currentKodeAkun].push({ uraian, realisasi });
      }
    }

    // --- FETCHING DATABASE DATA ---
    // Fetch relevant SPM Rincian from the database for the detected/specified year
    const rincianInDb = await prisma.spmRincian.findMany({
      where: {
        spm: {
          tahunAnggaran: currentYear, // Use the detected or default year
          // Optionally add satkerId filter if validation should be per-satker
          // satkerId: req.user.role === 'op_satker' ? req.user.satkerId : (parseInt(req.query.satkerId) || undefined),
        },
      },
      include: {
        kodeAkun: true, // Include KodeAkun details (like the code)
        spm: true, // Include parent SPM details (like nomorSpm)
      },
    });

    // --- COMPARISON LOGIC ---
    let results = []; // Array to store comparison results for each rincian item

    for (const rincian of rincianInDb) {
      // Find potential matches in the parsed SAKTI data based on Kode Akun
      const saktiItems = saktiData[rincian.kodeAkun.kode];
      let status = 'NOT_FOUND'; // Default status if no match is found
      let saktiAmount = null;
      let difference = null;

      // If items exist for this Kode Akun in the SAKTI data
      if (saktiItems) {
        // Find the specific item matching the Uraian (case-insensitive)
        const matchedItem = saktiItems.find(
          (item) =>
            item.uraian.toLowerCase().trim() ===
            rincian.uraian.toLowerCase().trim()
        );

        // If a matching Uraian is found
        if (matchedItem) {
          saktiAmount = matchedItem.realisasi; // Get the SAKTI amount
          difference = rincian.jumlah - saktiAmount; // Calculate the difference
          status = difference === 0 ? 'MATCH' : 'MISMATCH'; // Determine status based on difference
        }
        // If no matching Uraian found within the Kode Akun, status remains 'NOT_FOUND'
      }
      // If no items exist for this Kode Akun, status remains 'NOT_FOUND'

      // Add the comparison result to the results array
      results.push({
        spmNomor: rincian.spm.nomorSpm,
        rincianUraian: rincian.uraian,
        appAmount: rincian.jumlah,
        saktiAmount,
        difference,
        status,
      });
    }

    // Respond with the array of comparison results
    res.status(200).json(results); // Changed from { data: results } to just results
  } catch (error) {
    console.error('--- ERROR VALIDATING SAKTI REPORT ---', error);
    res.status(500).json({ error: 'Gagal memvalidasi laporan.' });
  }
};
