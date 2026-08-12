import Link from 'next/link';

export default function FilePreviewDocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <div>
          <Link href="/docs/markdown" className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white">← Markdown</Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">File preview</h1>
          <p className="mt-2 text-sm text-white/50">Custom file preview over default markdown — secondary objects, visuals, caching.</p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Where it lives</h2>
          <p className="text-xs text-white/50">Renderer <code className="text-white/70">components/NoteContentRenderer.tsx</code> parses <code className="text-white/70">parseObjectBlocks</code> (lib/note-object-secondary.ts) into text vs object nodes. Object nodes → <code className="text-white/70">SecondaryObjectShell</code> → <code className="text-white/70">AttachmentVisual</code>.</p>
          <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
{`text part → renderMarkdownHtml(part)
object part → SecondaryObjectShell(payload)
 payload: { childKind, childId, bucketId, label, href, appTheme, metadata }`}
          </pre>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Visual kinds • lib/note-object-visual.ts</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-sm text-white/50">
            <li>infers mime from ext/label/childKind → visualKind: <code className="text-white/70">image | video | audio | pdf | document | icon | link</code>.</li>
            <li>Theme color per app: vault #10B981, flow #22C55E, default #6366F1.</li>
          </ul>
          <div className="rounded-xl bg-[#0A0908] border border-white/[0.05] p-3 space-y-2">
            <p className="text-xs font-bold text-white/70">AttachmentVisual branches</p>
            <ul className="list-disc pl-4 space-y-1 text-xs text-white/50">
              <li><b className="text-white/70">image</b> → &lt;img&gt; max-h 480, contain, #0B0A09 bg</li>
              <li><b className="text-white/70">video</b> → &lt;video controls&gt; max-h 420</li>
              <li><b className="text-white/70">audio/voice</b> → VoiceNotePlayer / InheritedVoiceLoader</li>
              <li><b className="text-white/70">pdf</b> → &lt;iframe&gt; 420h</li>
              <li><b className="text-white/70">link</b> → favicon + host + href</li>
              <li><b className="text-white/70">document/icon</b> → centered icon chip + Open file btn</li>
            </ul>
          </div>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Data & caching</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-sm text-white/50">
            <li>Primary fetches via <code className="text-white/70">getNoteSecondaryObjectPreview</code> (client-ops) → <code className="text-white/70">fetchNoteObjectPreviewCached</code> key <code className="text-white/70">noteObjectPreviewCacheKey</code>.</li>
            <li>Fallback to <code className="text-white/70">getNoteInheritedFileBlob</code> for media when previewDataUrl missing, writes back to cache.</li>
            <li>Ephemeral notes (thread- / compose draft) skip server preview, use <code className="text-white/70">StorageService.getFilePreview/getFileView</code> directly client-side.</li>
            <li>Container: rounded 14px, border rgba(255,255,255,0.08), bg rgba(255,255,255,0.02).</li>
          </ul>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Overheads vs default markdown</h2>
          <p className="text-xs text-white/50">Default markdown would render <code className="text-white/70">![alt](url)</code> or link as img/a. Custom layer adds object-block protocol, permission-aware inherited blobs, visual kind routing, and caching — no extra markdown syntax to learn, but richer previews with openbricks opaque surfaces.</p>
        </section>
      </div>
    </div>
  );
}
