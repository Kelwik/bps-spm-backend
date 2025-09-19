const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

exports.getAllSatker = async (req, res) => {
  try {
    const allKodeAkun = await prisma.satker.findMany();
    res.status(200).json(allKodeAkun);
  } catch (error) {
    res.status(500).json({ error: error });
  }
};
