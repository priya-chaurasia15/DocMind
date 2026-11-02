const Chunk = require('../models/chunk');

// In-memory cache of each document's vectors, loaded lazily from MongoDB.
// Vectors are L2-normalised, so cosine similarity == dot product.
const cache = new Map();

async function load(docId) {
  const key = String(docId);
  if (cache.has(key)) return cache.get(key);

  const rows = await Chunk.find({ docId }).sort({ idx: 1 }).lean();
  const dim = rows.length ? rows[0].embedding.length : 0;
  const matrix = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => matrix.set(r.embedding, i * dim));

  const entry = { dim, matrix, rows: rows.map((r) => ({ page: r.page, text: r.text })) };
  cache.set(key, entry);
  return entry;
}

function cosineTopK(entry, query, k = 4) {
  const { matrix, dim, rows } = entry;
  const n = rows.length;
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) s += matrix[off + j] * query[j];
    scores[i] = s;
  }
  return Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, k)
    .map((i) => ({ ...rows[i], score: scores[i] }));
}

function evict(docId) {
  cache.delete(String(docId));
}

module.exports = { load, cosineTopK, evict };