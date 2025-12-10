const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// --- HELPER FUNCTION (No changes needed) ---
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
    (flag) => flag.tipe === 'IYA' || flag.tipe === 'IYA_TIDAK'
  ).length;
  const percentage = Math.round((totalJawabanIya / totalRequiredFlags) * 100);
  return Math.min(100, percentage);
}

// @desc    Mendapatkan semua rincian (dengan filter dan PAGINATION by SPM)
// @route   GET /api/rincian
exports.getAllRincian = async (req, res) => {
  try {
    // Accept pagination parameters, defaulting to 5 SPMs per page for this report
    const { satkerId, tahun, page = 1, limit = 5 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (tahun) {
      whereClause.tahunAnggaran = parseInt(tahun, 10);
    }
    if (req.user.role === 'op_satker') {
      whereClause.satkerId = req.user.satkerId;
    } else if (satkerId) {
      whereClause.satkerId = parseInt(satkerId, 10);
    }

    // 1. Get the total count of SPMs that match the filter
    const totalSpms = await prisma.spm.count({ where: whereClause });

    // 2. Get a paginated list of SPM IDs
    const spmsOnPage = await prisma.spm.findMany({
      where: whereClause,
      skip: skip,
      take: limitNum,
      orderBy: { tanggal: 'desc' },
      select: { id: true }, // We only need the IDs for the next step
    });

    const spmIdsOnPage = spmsOnPage.map((spm) => spm.id);

    // 3. Fetch all rincian that belong to those specific SPMs
    const allRincian = await prisma.spmRincian.findMany({
      where: {
        spmId: { in: spmIdsOnPage },
      },
      orderBy: { spm: { tanggal: 'desc' } }, // Keep the overall sort order
      include: {
        kodeAkun: true,
        jawabanFlags: true,
        spm: {
          include: {
            satker: { select: { nama: true } },
          },
        },
      },
    });

    // 4. Calculate percentage for the fetched rincian
    await Promise.all(
      allRincian.map(async (rincian) => {
        rincian.persentaseKelengkapan = await calculateRincianPercentage(
          rincian
        );
        delete rincian.jawabanFlags;
      })
    );

    // 5. Return the rincian list and pagination info based on the total SPMs
    res.status(200).json({
      rincian: allRincian,
      totalCount: totalSpms,
      totalPages: Math.ceil(totalSpms / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('--- DETAIL ERROR GET ALL RINCIAN ---', error);
    res.status(500).json({ error: 'Gagal mengambil daftar rincian.' });
  }
};
