const express = require('express');
const router = express.Router();
const kodeAkunController = require('../controllers/KodeAkunController');
const { protect } = require('../middleware/AuthMiddleware');

router.use(protect);
// GET /api/kode-akun -> Mendapatkan semua KodeAkun untuk dropdown
router.get('/', kodeAkunController.getAllKodeAkun);

// GET /api/kode-akun/:id/flags -> Mendapatkan semua flag yang dibutuhkan untuk satu KodeAkun
router.get('/:id/flags', kodeAkunController.getFlagsByKodeAkunId);

module.exports = router;
