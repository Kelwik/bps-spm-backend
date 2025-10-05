const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// @desc    Membuat flag baru untuk KodeAkun
// @route   POST /api/flags
exports.createFlag = async (req, res) => {
  const { nama, tipe, kodeAkunId } = req.body;

  if (!nama || !tipe || !kodeAkunId) {
    return res
      .status(400)
      .json({ error: 'Nama, tipe, dan kodeAkunId harus diisi.' });
  }

  try {
    const newFlag = await prisma.flag.create({
      data: {
        nama,
        tipe,
        kodeAkunId: parseInt(kodeAkunId),
      },
    });
    res.status(201).json(newFlag);
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Nama flag ini sudah ada untuk Kode Akun tersebut.' });
    }
    res.status(500).json({ error: 'Gagal membuat flag baru.' });
  }
};

// @desc    Mengupdate flag
// @route   PUT /api/flags/:id
exports.updateFlag = async (req, res) => {
  const { id } = req.params;
  const { nama, tipe } = req.body;

  try {
    const updatedFlag = await prisma.flag.update({
      where: { id: parseInt(id) },
      data: { nama, tipe },
    });
    res.status(200).json(updatedFlag);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate flag.' });
  }
};

// @desc    Menghapus flag
// @route   DELETE /api/flags/:id
exports.deleteFlag = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.flag.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'Flag berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus flag.' });
  }
};
