const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/ReportController');
const { protect } = require('../middleware/AuthMiddleware');

// Middleware untuk memastikan hanya admin provinsi yang bisa akses
const requireAdmin = (req, res, next) => {
  if (req.user && ['op_prov', 'supervisor'].includes(req.user.role)) {
    next();
  } else {
    res
      .status(403)
      .json({ error: 'Akses ditolak. Fitur ini hanya untuk admin.' });
  }
};

// Lindungi semua rute laporan
router.use(protect, requireAdmin);

router.get('/satker-performance', reportsController.getSatkerPerformance);

module.exports = router;
