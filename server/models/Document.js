const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pageCount: Number,
    chunkCount: Number,
    ingestMs: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', DocumentSchema);