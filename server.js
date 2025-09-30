const express = require('express');

const kodeAkunRoute = require('./routes/KodeAkunRoute');
const spmRoute = require('./routes/SpmRoute');
const rincianRoute = require('./routes/RincianRoute');
const authRoute = require('./routes/AuthRoute');
const satkerRoute = require('./routes/SatkerRoute');
require('dotenv').config();

const cors = require('cors');

const app = express();
const PORT = 3000;
app.use(express.json());
app.use(cors());

app.use('/api/auth', authRoute);
app.use('/api/kode-akun', kodeAkunRoute);
app.use('/api/rincian', rincianRoute);
app.use('/api/spm', spmRoute);
app.use('/api/satker', satkerRoute);

app.listen(PORT, () => {
  console.log(`Server ready at: http://localhost:${PORT}`);
});
