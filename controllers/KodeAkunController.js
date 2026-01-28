// controllers/KodeAkunController.js

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Mendapatkan semua KodeAkun
exports.getAllKodeAkun = async (req, res) => {
  try {
    const allKodeAkun = await prisma.kodeAkun.findMany({
      orderBy: { kode: 'asc' }, // Optional: Sort by kode
    });
    res.status(200).json(allKodeAkun);
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

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

// [NEW] Membuat Kode Akun baru
exports.createKodeAkun = async (req, res) => {
  const { kode, nama } = req.body;

  if (!kode || !nama) {
    return res.status(400).json({ error: 'Kode dan Nama akun harus diisi.' });
  }

  try {
    const newKodeAkun = await prisma.kodeAkun.create({
      data: { kode, nama },
    });
    res.status(201).json(newKodeAkun);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Kode Akun sudah ada.' });
    }
    res.status(500).json({ error: 'Gagal membuat Kode Akun.' });
  }
};
