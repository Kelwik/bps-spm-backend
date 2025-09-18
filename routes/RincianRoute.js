const express = require('express');
const router = express.Router();
const rincianController = require('../controllers/RincianController');

router.get('/', rincianController.getAllRincian);

router.get('/:id', rincianController.getRincianById);

module.exports = router;
