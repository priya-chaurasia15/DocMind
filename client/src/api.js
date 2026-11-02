export async function listDocs() {
  const r = await fetch('/api/docs');
  return r.json();
}

export async function uploadDoc(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/docs', { method: 'POST', body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Upload failed');
  return j;
}

export async function deleteDoc(id) {
  await fetch(`/api/docs/${id}`, { method: 'DELETE' });
}

// Streams NDJSON events: {type:'sources'|'token'|'done'|'error', ...}
export async function ask(docId, question, onEvent, signal) {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId, question }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error('Request failed');

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
      if (line) onEvent(JSON.parse(line));
    }
  }
}