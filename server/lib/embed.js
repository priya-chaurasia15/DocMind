const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'all-minilm'; // 46 MB, 384-dim, CPU friendly

function normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

// Returns an array of L2-normalised Float32Arrays, one per input text.
async function embed(texts) {
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Ollama embed failed (${res.status}). Is Ollama running and "${EMBED_MODEL}" pulled? ${body}`
    );
  }
  const json = await res.json();
  return json.embeddings.map(normalize);
}

async function embedAll(texts, batchSize = 32) {
  const out = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    out.push(...(await embed(texts.slice(i, i + batchSize))));
  }
  return out;
}

module.exports = { embed, embedAll, EMBED_MODEL };