// controllers/kodeAkun.controller.js

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Mendapatkan semua KodeAkun
exports.getAllKodeAkun = async (req, res) => {
  try {
    const allKodeAkun = await prisma.kodeAkun.findMany();
    res.status(200).json(allKodeAkun);
  } catch (error) {
    // 👇 PERUBAHAN PENTING DI SINI
    console.error('--- ERROR SAAT MENGAMBIL KODE AKUN ---');
    console.error(error); // Tampilkan error detail di terminal
    console.error('---------------------------------------');

    res.status(500).json({
      error:
        'Tidak dapat mengambil data Kode Akun. Cek log server untuk detail.',
    });
  }
};

// ... sisa kode Anda tetap sama

// Mendapatkan template flag berdasarkan ID KodeAkun
exports.getFlagsByKodeAkunId = async (req, res) => {
  try {
    const { id } = req.params;
    const flags = await prisma.flag.findMany({
      where: {
        kodeAkunId: parseInt(id),
      },
    });
    res.status(200).json(flags);
  } catch (error) {
    res.status(500).json({ error: 'Tidak dapat mengambil data flags.' });
  }
};
