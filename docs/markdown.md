# Markdown Rendering Pipeline

Kylrix features an advanced, multi-layer markdown parsing and execution pipeline built on `marked` with custom tactile extensions conforming to the OpenBricks design system.

---

## ⚙️ Parsing Pipeline

1. **Pre-processing (`lib/markdown/preprocess.ts`)**:
   - CRLF normalization to standard LF.
   - Voice note tags (`[voice:fileId]`) normalized to audio link representations.
   - Line break retention with code fence exclusion.
2. **Extraction Phase**:
   - `math.extract`: KaTeX math expressions (`$...$`, `$$...$$`, ` ```math `, ` ```solve `).
   - `quote-copy.extract`: Quoted strings (`"..."`, `'...'`) mapped to interactive copy cards.
   - `charts.extract`: Inline SVG chart definitions (` ```chart `, ` ```graph `).
   - `html-preview.extract`: Sandboxed HTML components.
3. **Core Parser**:
   - `marked.parse(pre, { gfm: true, breaks: true })`.
4. **Restoration & Sanitization**:
   - Post-pipeline restores placeholders outside paragraph wrappers.
   - DOMPurify sanitization with strict SVG/KaTeX Math and OpenBricks element whitelisting.

---

## 🎨 Tactile OpenBricks Quoted Copy Cards

Quoted phrases in markdown notes automatically transform into interactive quote-copy cards:
- Opaque surface backgrounds (`#161412` / `#0A0908`).
- One-click copy interaction with visual confirmation.
- Accessible keyboard shortcuts.
