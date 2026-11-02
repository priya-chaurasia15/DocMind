
function chunkPages(pages, { size = 700, overlap = 120 } = {}) {
  const chunks = [];
  for (const { page, text } of pages) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    let start = 0;
    while (start < clean.length) {
      let end = Math.min(start + size, clean.length);
      if (end < clean.length) {
        const win = clean.slice(start, end);
        const cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('? '), win.lastIndexOf('! '));
        if (cut > size * 0.5) end = start + cut + 1;
      }
      const piece = clean.slice(start, end).trim();
      if (piece.length > 30) chunks.push({ page, text: piece });
      if (end >= clean.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks.map((c, idx) => ({ ...c, idx }));
}

module.exports = { chunkPages };