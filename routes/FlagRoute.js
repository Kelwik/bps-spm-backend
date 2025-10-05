const express = require('express');
const router = express.Router();
const flagController = require('../controllers/FlagController');
const { protect } = require('../middleware/AuthMiddleware');

// Middleware untuk memastikan hanya admin provinsi yang bisa akses
const requireAdmin = (req, res, next) => {
  if (req.user && ['op_prov', 'supervisor'].includes(req.user.role)) {
    next();
  } else {
    res
      .status(403)
      .json({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
};

// Lindungi semua rute flag dengan autentikasi dan pengecekan admin
router.use(protect, requireAdmin);

router.route('/').post(flagController.createFlag);

router
  .route('/:id')
  .put(flagController.updateFlag)
  .delete(flagController.deleteFlag);

module.exports = router;
