// routes/index.js
const express = require('express');
const router = express.Router();
const apiRoutes = require('./api');
const webhookRoutes = require('./webhookRoutes');

// Rutas de API
router.use('/api', apiRoutes);

// Rutas de webhook (en la raíz para compatibilidad con Meta API)
router.use('/webhook', webhookRoutes);

module.exports = router;