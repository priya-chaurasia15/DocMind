import React, { useEffect, useRef, useState } from 'react';
import { ask, deleteDoc, listDocs, uploadDoc } from './api.js';

// Turns "[p.3]" markers in the answer into page badges.
function Answer({ text }) {
  const parts = text.split(/(\[p\.\s*\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[p\.\s*(\d+)\]$/);
        return m ? (
          <span key={i} className="badge">p.{m[1]}</span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export default function App() {
  const [docs, setDocs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const refresh = async () => {
    const d = await listDocs();
    setDocs(d);
    if (!activeId && d.length) setActiveId(d[0]._id);
  };

  useEffect(() => { refresh().catch(() => setError('Cannot reach the API. Is the server running?')); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const doc = await uploadDoc(file);
      await refresh();
      setActiveId(doc._id);
      setMessages([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const onDelete = async (id) => {
    await deleteDoc(id);
    if (id === activeId) { setActiveId(null); setMessages([]); }
    const d = await listDocs();
    setDocs(d);
    if (id === activeId && d.length) setActiveId(d[0]._id);
  };

  const patchLast = (fn) =>
    setMessages((m) => m.map((x, i) => (i === m.length - 1 ? fn(x) : x)));

  const onSend = async (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || !activeId || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'ai', text: '', sources: [] }]);
    try {
      await ask(activeId, q, (ev) => {
        if (ev.type === 'sources') patchLast((x) => ({ ...x, sources: ev.sources, retrievalMs: ev.retrievalMs }));
        else if (ev.type === 'token') patchLast((x) => ({ ...x, text: x.text + ev.text }));
        else if (ev.type === 'error') setError(ev.message);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>DocMind</h1>
        <p className="tag">Offline PDF Q&amp;A</p>
        <button className="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Indexing…' : '+ Upload PDF'}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onUpload} />
        <ul className="docs">
          {docs.map((d) => (
            <li key={d._id} className={d._id === activeId ? 'active' : ''}>
              <button className="doc" onClick={() => { setActiveId(d._id); setMessages([]); }}>
                <span className="name">{d.name}</span>
                <span className="meta">{d.pageCount} pages · {d.chunkCount} chunks</span>
              </button>
              <button className="del" title="Delete" onClick={() => onDelete(d._id)}>×</button>
            </li>
          ))}
          {!docs.length && <li className="empty">No documents yet.</li>}
        </ul>
      </aside>

      <main className="chat">
        <div className="messages">
          {!messages.length && (
            <div className="hint">
              {activeId ? 'Ask a question about the selected PDF.' : 'Upload a PDF to get started.'}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.role === 'ai' ? <Answer text={m.text || (busy && i === messages.length - 1 ? '…' : '')} /> : m.text}
              </div>
              {m.role === 'ai' && m.sources?.length > 0 && (
                <details className="sources">
                  <summary>
                    Sources: {[...new Set(m.sources.map((s) => s.page))].map((p) => `p.${p}`).join(', ')}
                    {m.retrievalMs != null && <em> · retrieved in {m.retrievalMs} ms</em>}
                  </summary>
                  {m.sources.map((s, j) => (
                    <div key={j} className="src">
                      <b>p.{s.page}</b> <span className="score">{s.score}</span>
                      <p>{s.snippet}…</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && <div className="error">{error}</div>}

        <form className="composer" onSubmit={onSend}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeId ? 'Ask about this document…' : 'Upload a PDF first'}
            disabled={!activeId || busy}
          />
          <button className="primary" disabled={!activeId || busy || !input.trim()}>Send</button>
        </form>
      </main>
    </div>
  );
}