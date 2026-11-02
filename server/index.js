require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes/docs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

// Serve the built React app in production (npm run build in /client)
const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => err && next());
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docmind';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`DocMind API on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });