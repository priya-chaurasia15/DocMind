const express = require('express');
const multer = require('multer');
const DocModel = require('../models/Document');
const Chunk = require('../models/chunk');
const { extractPages } = require('../lib/pdf');
const { chunkPages } = require('../lib/chunker');
const { embed, embedAll } = require('../lib/embed');
const store = require('../lib/vectorStore');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2:1b';
const TOP_K = Number(process.env.TOP_K) || 4;

// ---- Upload + ingest ------------------------------------------------------
router.post('/docs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file).' });
    const t0 = Date.now();

    const pages = await extractPages(req.file.buffer);
    const chunks = chunkPages(pages);
    if (!chunks.length) {
      return res.status(422).json({
        error: 'No extractable text found. Scanned PDFs need OCR first.',
      });
    }

    const vectors = await embedAll(chunks.map((c) => c.text));
    const doc = await DocModel.create({
      name: req.file.originalname,
      pageCount: pages.length,
      chunkCount: chunks.length,
      ingestMs: Date.now() - t0,
    });

    await Chunk.insertMany(
      chunks.map((c, i) => ({
        docId: doc._id,
        idx: c.idx,
        page: c.page,
        text: c.text,
        embedding: Array.from(vectors[i]),
      }))
    );

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/docs', async (_req, res) => {
  res.json(await DocModel.find().sort({ createdAt: -1 }).lean());
});

router.delete('/docs/:id', async (req, res) => {
  await Chunk.deleteMany({ docId: req.params.id });
  await DocModel.findByIdAndDelete(req.params.id);
  store.evict(req.params.id);
  res.json({ ok: true });
});

// ---- Ask (retrieval + streamed generation) -------------------------------
router.post('/ask', async (req, res) => {
  const { docId, question } = req.body || {};
  if (!docId || !question) return res.status(400).json({ error: 'docId and question are required.' });

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    // 1. Retrieve
    const tRetrieve = Date.now();
    const entry = await store.load(docId);
    if (!entry.rows.length) throw new Error('Document not found or has no chunks.');
    const [qvec] = await embed([question]);
    const hits = store.cosineTopK(entry, qvec, TOP_K);
    const retrievalMs = Date.now() - tRetrieve;

    send({
      type: 'sources',
      retrievalMs,
      sources: hits.map((h) => ({
        page: h.page,
        score: Number(h.score.toFixed(3)),
        snippet: h.text.slice(0, 220),
      })),
    });

    // 2. Generate (stream tokens from Ollama)
    const context = hits.map((h) => `[p.${h.page}] ${h.text}`).join('\n\n');
    const messages = [
      {
        role: 'system',
        content:
          'You answer questions about a PDF using ONLY the provided context. ' +
          'Cite the page of every fact like [p.3]. ' +
          'If the answer is not in the context, say you could not find it in the document. Be concise.',
      },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
    ];

    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        stream: true,
        options: { temperature: 0.2, num_ctx: 4096 },
      }),
    });
    if (!r.ok) throw new Error(`Ollama chat failed (${r.status}). Is "${LLM_MODEL}" pulled?`);

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.message?.content) send({ type: 'token', text: j.message.content });
      }
    }
    send({ type: 'done' });
  } catch (err) {
    if (err.name !== 'AbortError') send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

module.exports = router;