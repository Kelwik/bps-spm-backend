// routes/KodeAkunRoute.js
const express = require('express');
const router = express.Router();
const kodeAkunController = require('../controllers/KodeAkunController');
const { protect } = require('../middleware/AuthMiddleware');

// Middleware check admin (Local definition)
const requireAdmin = (req, res, next) => {
  if (req.user && ['op_prov', 'supervisor'].includes(req.user.role)) {
    next();
  } else {
    res
      .status(403)
      .json({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
};

router.use(protect);

// GET /api/kode-akun -> Mendapatkan semua KodeAkun (Public for auth users)
router.get('/', kodeAkunController.getAllKodeAkun);

// GET /api/kode-akun/:id/flags -> Mendapatkan flags
router.get('/:id/flags', kodeAkunController.getFlagsByKodeAkunId);

// [NEW] POST /api/kode-akun -> Membuat Kode Akun baru (Admin only)
router.post('/', requireAdmin, kodeAkunController.createKodeAkun);

module.exports = router;
