import Link from 'next/link';

const LAYERS = [
  { href: '/docs/markdown/quote-copy', title: 'Quote copy', desc: `'...' / "..." wrapped blocks → copy card (✦ + copy button)`, order: '22 / 82' },
  { href: '/docs/markdown/file-preview', title: 'File preview', desc: 'Secondary objects — image / video / pdf / audio / link with inherited blobs', order: 'NoteContentRenderer' },
  { href: '#math', title: 'Math (KaTeX)', desc: '$…$  $$…$$  ```math  ```solve → KaTeX HTML', order: '20 / 80' },
  { href: '#charts', title: 'Charts', desc: '```chart  ```graph → SVG bar/line & function plots', order: '25 / 85' },
  { href: '#html-preview', title: 'HTML preview', desc: '```html-preview — sandboxed, off by default in notes', order: '30 / 90' },
  { href: '#voice', title: 'Voice notes', desc: '[voice:fileId] → VoiceNotePlayer', order: 'inline split' },
  { href: '#preprocess', title: 'Preprocess', desc: 'CRLF→LF, [voice:]→link, single line breaks → two spaces (skips headings/lists/blockquote)', order: 'pre' },
  { href: '#sanitize', title: 'Sanitize', desc: 'DOMPurify MATH_PURIFY — allows svg/math + data-quote/data-copy', order: 'post' },
];

export default function MarkdownDocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <div>
          <Link href="/docs" className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white">← Docs</Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">Markdown rendering</h1>
          <p className="mt-2 text-sm text-white/50">Every custom layer over <code className="text-white/70">marked</code> GFM + breaks — pipeline, overheads, file preview.</p>
          <p className="mt-2 text-xs text-white/40">Source: <code className="text-white/60">lib/markdown/*</code> · renderer: <code className="text-white/60">components/NoteContentRenderer.tsx</code> · preview: idea detail (Write ↔ Preview)</p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Pipeline</h2>
          <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
{`marked.setOptions({ gfm: true, breaks: true })
ensureMarkdownLayers() // 20 math.extract → 22 quote-copy.extract → 25 charts.extract → 30 html-preview.extract
marked.parse(pre) → runPipeline('post') → DOMPurify.sanitize(MATH_PURIFY)
post: 80 math.restore → 82 quote-copy.restore → 85 charts.restore → 90 html-preview.restore`}
          </pre>
          <p className="text-xs text-white/40">Pre protects code fences/inline code; post restores placeholders outside &lt;p&gt; wrappers. Quote-copy now wraps inner with one quote at start and one at end.</p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Layers</h2>
          <div className="grid gap-3">
            {LAYERS.map((l) => (
              <Link key={l.title} href={l.href} className="rounded-xl bg-[#0A0908] border border-white/[0.05] p-4 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{l.title}</h3>
                  <span className="text-[10px] font-mono text-white/35">{l.order}</span>
                </div>
                <p className="text-xs text-white/45 mt-1">{l.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="preprocess" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Preprocess • lib/markdown/preprocess.ts</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-sm text-white/50">
            <li>Normalize CRLF → LF, rewrite <code className="text-white/70">[voice: id]</code> → <code className="text-white/70">[Voice Note](voice:id)</code>.</li>
            <li>Split fenced ```/~~~ blocks, skip them; for other lines add two trailing spaces to force line break, skipping headings, list items, blockquotes, indented code, reference links.</li>
          </ul>
        </section>

        <section id="math" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Math • lib/markdown/math.ts</h2>
          <p className="text-xs text-white/50">Flow <code className="text-white/70">kylrix-math-mode</code> gates. Extracts ```math|tex|latex, ```solve, $$…$$, $…$ to placeholders, renders via KaTeX, restores post. `kylrix-solve` stack for solve fences.</p>
        </section>

        <section id="charts" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Charts • lib/markdown/charts.ts</h2>
          <p className="text-xs text-white/50">Fenced ```chart (kv: type, title, labels, values) → SVG bar/line; ```graph (y= expr, x range) → sampled polyline with evalExpression. Placeholders @@KYLRIX_CHART_.</p>
        </section>

        <section id="html-preview" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">HTML preview • lib/markdown/html-preview.ts</h2>
          <p className="text-xs text-white/50">Fenced ```html-preview → &lt;div data-kylrix-html-preview&gt; with script/on* stripped and javascript: removed. Only enabled when <code className="text-white/70">ctx.features.htmlPreview</code> true — never in note preview by default.</p>
        </section>

        <section id="voice" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Voice • NoteContentRenderer</h2>
          <p className="text-xs text-white/50">Splits content by <code className="text-white/70">[voice:fileId]</code> regex; renders <code className="text-white/70">VoiceNotePlayer</code> inline, blocks overlap with object blocks handling.</p>
        </section>

        <section id="sanitize" className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Sanitize • lib/markdown/render.ts</h2>
          <p className="text-xs text-white/50">DOMPurify MATH_PURIFY: ADD_TAGS svg/math + ADD_ATTR class/style/viewBox/data-quote/data-copy/title/type. Quoted copy card uses opaque #161412/#0A0908, border rgba(255,255,255,0.06), no gradients/blur per openbricks.</p>
        </section>

        <div className="flex gap-3">
          <Link href="/docs/markdown/quote-copy" className="flex-1 rounded-xl bg-[#6366F1] text-white text-sm font-bold py-3 text-center hover:bg-[#5558e6] transition-colors">Quote copy →</Link>
          <Link href="/docs/markdown/file-preview" className="flex-1 rounded-xl bg-[#0A0908] border border-white/10 text-white text-sm font-bold py-3 text-center hover:border-white/15 transition-colors">File preview →</Link>
        </div>
      </div>
    </div>
  );
}
