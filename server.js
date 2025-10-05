const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const kodeAkunRoute = require('./routes/KodeAkunRoute');
const spmRoute = require('./routes/SpmRoute');
const rincianRoute = require('./routes/RincianRoute');
const authRoute = require('./routes/AuthRoute');
const satkerRoute = require('./routes/SatkerRoute');
const flagRoute = require('./routes/FlagRoute');
const reportRoute = require('./routes/ReportRoute');

const app = express();
const PORT = 3000;

// --- FIXES ARE HERE ---

// 1. Enable CORS for all routes. This should come before other middleware.
app.use(cors());

// 2. Increase the request body size limit.
// The default is around 100kb. We'll increase it to 50mb to handle large files.
// This MUST come before you define your routes.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROUTES DEFINITION (No changes here) ---
app.use('/api/auth', authRoute);
app.use('/api/kode-akun', kodeAkunRoute);
app.use('/api/rincian', rincianRoute);
app.use('/api/spm', spmRoute);
app.use('/api/satker', satkerRoute);
app.use('/api/flags', flagRoute);
app.use('/api/reports', reportRoute);

app.listen(PORT, () => {
  console.log(`Server ready at: http://localhost:${PORT}`);
});
