const express = require('express');
const router = express.Router();
const rincianController = require('../controllers/RincianController');
const { protect } = require('../middleware/AuthMiddleware');

router.use(protect);
// GET /api/kode-aku

router.get('/', rincianController.getAllRincian);

module.exports = router;
