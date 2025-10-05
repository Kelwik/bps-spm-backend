const express = require('express');
const router = express.Router();
const spmController = require('../controllers/SpmController');

const { protect } = require('../middleware/AuthMiddleware');

router.use(protect);
// GET /api/kode-aku
// Rute yang digabungkan untuk /api/spm
router
  .route('/')
  .get(spmController.getAllSpms) // GET    -> Mendapatkan semua SPM
  .post(spmController.createSpmWithRincian); // POST   -> Membuat SPM baru

router.post('/validate-report', spmController.validateSaktiReport);
// Rute yang digabungkan untuk /api/spm/:id
router
  .route('/:id')
  .get(spmController.getSpmById) // GET    -> Mendapatkan satu SPM
  .put(spmController.updateSpm) // PUT    -> Mengupdate satu SPM
  .delete(spmController.deleteSpm); // DELETE -> Menghapus satu SPM

router.patch('/:id/status', spmController.updateSpmStatus);
module.exports = router;
