const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

exports.getAllRincian = async (req, res) => {
  try {
    const allRincian = await prisma.spmRincian.findMany({
      include: {
        spm: {
          include: {
            satker: true, // fetch Satker too
          },
        },
        kodeAkun: {
          include: {
            templateFlags: true, // fetch template flags of the kodeAkun
          },
        },
        jawabanFlags: true, // fetch user’s answers for this rincian
      },
    });
    res.status(200).json(allRincian);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Data Tidak Ditemukan : ${error}` });
  }
};

exports.getRincianById = async (req, res) => {
  try {
    const { id } = req.params;
    const rincian = await prisma.spmRincian.findMany({
      where: {
        id: parseInt(id),
      },
      include: {
        spm: {
          include: {
            satker: true, // fetch Satker too
          },
        },
        kodeAkun: {
          include: {
            templateFlags: true, // fetch template flags of the kodeAkun
          },
        },
        jawabanFlags: true, // fetch user’s answers for this rincian
      },
    });
    res.status(200).json(rincian);
  } catch (error) {
    res.status(500).json({ error: `Data Tidak Ditemukan : ${error}` });
  }
};
