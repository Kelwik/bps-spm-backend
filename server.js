const express = require('express');

const kodeAkunRoute = require('./routes/KodeAkunRoute');

const app = express();
const PORT = 3000;
app.use(express.json());

app.use('/api/kode-akun', kodeAkunRoute);

app.listen(PORT, () => {
  console.log(`Server ready at: http://localhost:${PORT}`);
});
