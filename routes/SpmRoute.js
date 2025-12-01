const express = require('express');
const router = express.Router();
const spmController = require('../controllers/SpmController');
const { protect } = require('../middleware/AuthMiddleware');
const multer = require('multer');

// Konfigurasi Multer untuk upload file (menyimpan di memori sementara)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit 10MB
});

router.use(protect);

// --- ROUTES BARU ---
// 1. Download Template
router.get('/template', spmController.downloadImportTemplate);

// 2. Import Excel
router.post('/import', upload.single('file'), spmController.importSpms);

// --- ROUTES LAMA ---
router
  .route('/')
  .get(spmController.getAllSpms)
  .post(spmController.createSpmWithRincian);

router.post('/validate-report', spmController.validateSaktiReport);

router
  .route('/:id')
  .get(spmController.getSpmById)
  .put(spmController.updateSpm)
  .delete(spmController.deleteSpm);

router.patch('/:id/status', spmController.updateSpmStatus);

module.exports = router;
