const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const Imap = require('imap');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password harus diisi.' });
  }

  // Jika email mengandung '@', gunakan autentikasi lokal
  if (email.includes('@')) {
    console.log(`Attempting local authentication for: ${email}`);
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email atau password salah.' });
      }
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({ error: 'Email atau password salah.' });
      }
      const payload = {
        id: user.id,
        name: user.name,
        role: user.role,
        satkerId: user.satkerId,
      };
      const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      });
      return res.status(200).json({ token });
    } catch (error) {
      console.error('Server error during local login:', error);
      return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  }
  // Jika tidak, gunakan autentikasi IMAP
  else {
    console.log(`Attempting IMAP authentication for: ${email}`);
    let responded = false;
    try {
      const imap = new Imap({
        user: email,
        password: password,
        host: 'mail.bps.go.id',
        port: 993,
        tls: true,
        authTimeout: 20000, // Perpanjang timeout menjadi 20 detik
      });

      const handleResponse = (statusCode, data) => {
        if (!responded) {
          responded = true;
          try {
            imap.end();
          } catch (e) {}
          res.status(statusCode).json(data);
        }
      };

      imap.once('ready', async () => {
        console.log(`IMAP authentication successful for: ${email}`);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return handleResponse(403, {
            error:
              'Autentikasi berhasil, namun Anda tidak memiliki izin untuk mengakses aplikasi ini.',
          });
        }
        const payload = {
          id: user.id,
          name: user.name,
          role: user.role,
          satkerId: user.satkerId,
        };
        const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '1d',
        });
        handleResponse(200, { token });
      });

      imap.once('error', (err) => {
        console.error(`IMAP authentication failed for ${email}:`, err.message);
        handleResponse(401, { error: 'Username atau password IMAP salah.' });
      });

      // Handler baru untuk timeout koneksi
      imap.once('timeout', () => {
        console.error(`IMAP connection timed out for ${email}`);
        handleResponse(504, { error: 'Koneksi ke server email timeout.' });
      });

      imap.connect();
    } catch (error) {
      console.error('Server error during IMAP login process:', error);
      if (!responded)
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        satker: {
          // Include the related Satker name
          select: {
            nama: true,
          },
        },
      },
    });
    // Don't send passwords to the client
    users.forEach((user) => delete user.password);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil daftar pengguna.' });
  }
};

// @desc    Create a new user
// @route   POST /api/users
exports.createUser = async (req, res) => {
  const { email, name, role, satkerId, password } = req.body;

  if (!email || !name || !role || !password) {
    return res
      .status(400)
      .json({ error: 'Email, nama, peran, dan password harus diisi.' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: passwordHash,
        satkerId: satkerId ? parseInt(satkerId) : null,
      },
    });
    delete newUser.password;
    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: `Email '${email}' sudah terdaftar.` });
    }
    res.status(500).json({ error: 'Gagal membuat pengguna baru.' });
  }
};

// @desc    Update a user
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, role, satkerId, password } = req.body;

  try {
    const dataToUpdate = {
      name,
      role,
      satkerId: satkerId ? parseInt(satkerId) : null,
    };

    // If a new password is provided, hash and update it
    if (password) {
      dataToUpdate.password = bcrypt.hashSync(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });
    delete updatedUser.password;
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui pengguna.' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) },
    });
    res.status(200).json({ message: 'Pengguna berhasil dihapus.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    res.status(500).json({ error: 'Gagal menghapus pengguna.' });
  }
};
