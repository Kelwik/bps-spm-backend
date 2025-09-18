const express = require('express');
const router = express.Router();
const spmController = require('../controllers/SpmController');

// Rute yang digabungkan untuk /api/spm
router
  .route('/')
  .get(spmController.getAllSpms) // GET    -> Mendapatkan semua SPM
  .post(spmController.createSpmWithRincian); // POST   -> Membuat SPM baru

// Rute yang digabungkan untuk /api/spm/:id
router
  .route('/:id')
  .get(spmController.getSpmById) // GET    -> Mendapatkan satu SPM
  .put(spmController.updateSpm) // PUT    -> Mengupdate satu SPM
  .delete(spmController.deleteSpm); // DELETE -> Menghapus satu SPM

module.exports = router;
