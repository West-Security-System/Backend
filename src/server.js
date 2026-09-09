require('dotenv').config();

const cors = require('cors');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);
const version = process.env.APP_VERSION || '0.1.0';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5500'
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version
  });
});

app.listen(port, () => {
  console.log(`West Security API listening on port ${port}`);
});
