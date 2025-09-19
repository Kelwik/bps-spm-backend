const express = require('express');
const router = express.Router();
const kodeAkunController = require('../controllers/KodeAkunController');
const { protect } = require('../middleware/AuthMiddleware');
const satkerController = require('../controllers/SatkerController');

router.use(protect);
// GET /api/kode-akun -> Mendapatkan semua KodeAkun untuk dropdown
router.get('/', satkerController.getAllSatker);

module.exports = router;
