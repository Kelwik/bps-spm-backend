const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Login pengguna dan dapatkan token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Cari pengguna berdasarkan email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // 2. Bandingkan password yang diinput dengan hash di database
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // 3. Jika cocok, buat payload untuk JWT
    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      satkerId: user.satkerId, // Akan null jika user provinsi
    };

    // 4. Buat dan kirim JWT
    const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1d', // Token berlaku selama 1 hari
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};
