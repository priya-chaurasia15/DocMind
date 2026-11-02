const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
  docId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', index: true, required: true },
  idx: Number,
  page: Number,
  text: String,
  embedding: { type: [Number], required: true }, // L2-normalised vector
});

module.exports = mongoose.model('Chunk', ChunkSchema);