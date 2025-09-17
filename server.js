const express = require('express');

const app = express();
const PORT = 3000;
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'SMP' });
});
app.listen(PORT, () => {
  console.log(`Server ready at: http://localhost:${PORT}`);
});
