const jwt = require('jsonwebtoken');
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

exports.protect = async (req, res, next) => {
  let token;

  // Cek apakah header Authorization ada dan formatnya benar ('Bearer token')
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Ambil token dari header (Bearer[0] token[1])
      token = req.headers.authorization.split(' ')[1];

      // Verifikasi token menggunakan secret key
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // Ambil data user dari database (tanpa password) dan pasang di request
      // Ini akan membuat req.user tersedia di semua controller selanjutnya
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          satkerId: true,
        },
      });

      next(); // Lanjutkan ke controller selanjutnya
    } catch (error) {
      return res
        .status(401)
        .json({ error: 'Tidak terautentikasi, token gagal.' });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: 'Tidak terautentikasi, tidak ada token.' });
  }
};
