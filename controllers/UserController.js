const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const Imap = require('imap');
const bcrypt = require('bcryptjs');

// @desc    Login pengguna menggunakan IMAP atau fallback ke akun lokal
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password harus diisi.' });
  }

  // --- LOGIKA BARU YANG DIBALIK ---
  // Jika email TIDAK mengandung '@', maka diasumsikan itu adalah username IMAP.
  if (!email.includes('@')) {
    // --- METODE UTAMA: AUTENTIKASI IMAP (UNTUK PENGGUNA BPS ASLI) ---
    console.log(`Attempting IMAP authentication for: ${email}`);
    try {
      const imap = new Imap({
        user: email, // Menggunakan username singkat
        password: password,
        host: 'mail.bps.go.id',
        port: 993,
        tls: true,
      });

      imap.once('ready', async () => {
        console.log(`IMAP authentication successful for: ${email}`);
        imap.end();

        // Cari pengguna di database kita berdasarkan username singkat tersebut
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return res.status(403).json({
            error:
              'Autentikasi berhasil, namun Anda tidak memiliki izin untuk mengakses aplikasi ini.',
          });
        }

        // Buat dan kirim token
        const payload = {
          id: user.id,
          name: user.name,
          role: user.role,
          satkerId: user.satkerId,
        };
        const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '1d',
        });
        res.status(200).json({ token });
      });

      imap.once('error', (err) => {
        console.error(`IMAP authentication failed for ${email}:`, err.message);
        res.status(401).json({ error: 'Username atau password IMAP salah.' });
      });

      imap.connect();
    } catch (error) {
      console.error('Server error during IMAP login process:', error);
      res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  } else {
    // --- FALLBACK: AUTENTIKASI LOKAL (UNTUK AKUN EMAIL LENGKAP) ---
    console.log(`Attempting local authentication for: ${email}`);
    try {
      // 1. Cari pengguna di database lokal berdasarkan email lengkap
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email atau password salah.' });
      }

      // 2. Bandingkan password yang diberikan dengan hash di database
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({ error: 'Email atau password salah.' });
      }

      // 3. Jika cocok, buat dan kirim token
      const payload = {
        id: user.id,
        name: user.name,
        role: user.role,
        satkerId: user.satkerId,
      };
      const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      });

      console.log(`Local authentication successful for: ${email}`);
      return res.status(200).json({ token });
    } catch (error) {
      console.error('Server error during local login:', error);
      return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  }
};
