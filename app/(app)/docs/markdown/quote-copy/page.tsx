import Link from 'next/link';

export default function QuoteCopyDocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <div>
          <Link href="/docs/markdown" className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white">← Markdown</Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">Quote copy</h1>
          <p className="mt-2 text-sm text-white/50">Single `'...'` or double `"..."` wrapped blocks → cute copy card in preview.</p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Rule</h2>
          <p className="text-sm text-white/50">If a block of text is wrapped in matching single or double quotes (≥2 chars, not across lines), render specially with one quote at start and one at end inside the box plus copy icon. Skips contractions like <code className="text-white/70">it&apos;s</code> (requires space or ≥3 chars) and ignores <code className="text-white/70">`code`</code> / ``` fences.</p>
          <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
{`'hello world this is cute'  →  card with 'hello world this is cute' + ✦ + copy
"hello world"                →  card with "hello world" + ✦ + copy`}
          </pre>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Implementation</h2>
          <p className="text-xs text-white/50">File <code className="text-white/70">lib/markdown/quote-copy.ts</code> — order 22 extract / 82 restore. Protects fences & inline code, then:</p>
          <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
{`/(^|[^\\w\\\\])"([^"\\n]{2,}?)"/  → renderQuoteCopyHtml(inner,'"')
/(^|[^\\w\\\\])'([^'\\n]{2,}?)'/   → renderQuoteCopyHtml(inner,"'")
render: escQuote+escText+escQuote inside ✦ chip + copy btn (data-copy)
restore: <p>@@KYLRIX_QC_n@@</p> → block, else inline`}
          </pre>
          <p className="text-xs text-white/40">Card style: opaque #161412, border rgba(255,255,255,0.06), 14px radius, top hairline, ✦ chip #0A0908, copy btn #0A0908 → green check on copy. Global delegated click on .kylrix-quote-copy-btn.</p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Overheads</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-sm text-white/50">
            <li>Available instantly in idea preview (NoteContentRenderer → renderMarkdownHtml).</li>
            <li>Does not break default markdown: code fences preserved, DOMPurify allowlists data-quote/data-copy.</li>
            <li>Fix for double-quote display: now one quote at start and one at end inside the box (was two together).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
