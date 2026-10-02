'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  WidgetType,
  Decoration,
  DecorationSet,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { EditorState, StateField, Range, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting, syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { parseObjectBlocks, type SecondaryObjectPayload } from '@/lib/note-object-secondary';
import { StorageService } from '@/lib/services/storage';
import { detachObjectByRelation } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import toast from 'react-hot-toast';

/** Markdown punctuation nodes to hide unless the caret is inside that construct. */
const MARKDOWN_MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'StrongMark',
  'CodeMark',
  'LinkMark',
  'StrikethroughMark',
  'QuoteMark',
  'ListMark',
  'LinkTitle',
]);

const liveMarkdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.75rem', fontWeight: '800', fontFamily: 'var(--font-clash), sans-serif', color: '#FFFFFF', lineHeight: '1.3' },
  { tag: tags.heading2, fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-clash), sans-serif', color: '#FFFFFF', lineHeight: '1.35' },
  { tag: tags.heading3, fontSize: '1.15rem', fontWeight: '700', fontFamily: 'var(--font-clash), sans-serif', color: '#FFFFFF', lineHeight: '1.4' },
  { tag: tags.heading4, fontSize: '1.05rem', fontWeight: '700', color: '#FFFFFF' },
  { tag: tags.heading5, fontSize: '1rem', fontWeight: '700', color: '#FFFFFF' },
  { tag: tags.heading6, fontSize: '0.95rem', fontWeight: '700', color: '#FFFFFF' },
  { tag: tags.strong, fontWeight: '800', color: '#FFFFFF' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#FFFFFF' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'rgba(255,255,255,0.72)' },
  { tag: tags.link, color: '#818CF8', textDecoration: 'underline', textUnderlineOffset: '3px' },
  { tag: tags.url, color: '#818CF8', opacity: 0.85 },
  { tag: tags.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em', color: '#A5B4FC', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px' },
  { tag: tags.quote, color: 'rgba(255,255,255,0.78)', fontStyle: 'italic' },
  { tag: tags.list, color: '#FFFFFF' },
  // Visible only when not decoration-hidden (caret inside that construct).
  { tag: tags.processingInstruction, color: 'rgba(255,255,255,0.4)' },
  { tag: tags.meta, color: 'rgba(255,255,255,0.4)' },
  { tag: tags.contentSeparator, color: 'rgba(255,255,255,0.2)' },
]);

const hiddenMarkDeco = Decoration.replace({});

/**
 * Hide markdown punctuation by default; reveal when the caret/selection
 * intersects that mark's parent construct (heading, bold span, link, …).
 * Read-only: always hide.
 */
function buildHiddenMarkdownMarks(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  ensureSyntaxTree(view.state, view.viewport.to, 150);

  const selection = view.state.selection.main;
  const editable = view.state.facet(EditorView.editable);
  const isFocused = view.hasFocus;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (!MARKDOWN_MARK_NODES.has(node.name)) return;
        if (node.to <= node.from) return;

        if (editable && isFocused) {
          const parent = node.node.parent;
          const regionFrom = parent ? parent.from : node.from;
          const regionTo = parent ? parent.to : node.to;
          // Caret inside this construct while focused → keep modifiers visible for editing.
          if (selection.from <= regionTo && selection.to >= regionFrom) return;
        }

        ranges.push(hiddenMarkDeco.range(node.from, node.to));
      },
    });
  }

  return Decoration.set(ranges, true);
}

const liveMarkdownMarkHider = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildHiddenMarkdownMarks(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.focusChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildHiddenMarkdownMarks(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/**
 * Live decoration plugin that highlights environment variables (KEY=VALUE)
 * and detects plain URIs/URLs, giving them high-contrast, distinct styling.
 */
const envAndUriDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }
    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          const envMatch = lineText.match(/^([A-Za-z_][A-Za-z0-9_]{1,63})(=)(.*)$/);
          if (envMatch) {
            const keyStart = line.from;
            const keyEnd = keyStart + envMatch[1].length;
            const eqStart = keyEnd;
            const eqEnd = eqStart + 1;
            const valStart = eqEnd;
            const valEnd = line.to;

            builder.add(keyStart, keyEnd, Decoration.mark({ class: 'cm-env-key' }));
            builder.add(eqStart, eqEnd, Decoration.mark({ class: 'cm-env-eq' }));

            if (valStart < valEnd) {
              const valText = envMatch[3];
              const uriMatch = valText.match(/(?:https?|libsql|wss?|ftp):\/\/[^\s<>"')]+/);
              if (uriMatch && uriMatch.index !== undefined && uriMatch[0].length > 0) {
                const uriStart = valStart + uriMatch.index;
                const uriEnd = uriStart + uriMatch[0].length;
                if (valStart < uriStart) {
                  builder.add(valStart, uriStart, Decoration.mark({ class: 'cm-env-val' }));
                }
                builder.add(uriStart, uriEnd, Decoration.mark({ class: 'cm-detected-uri' }));
                if (uriEnd < valEnd) {
                  builder.add(uriEnd, valEnd, Decoration.mark({ class: 'cm-env-val' }));
                }
              } else {
                builder.add(valStart, valEnd, Decoration.mark({ class: 'cm-env-val' }));
              }
            }
          } else {
            const uriRegex = /(?:https?|libsql|wss?|ftp):\/\/[^\s<>"')]+/g;
            let m: RegExpExecArray | null;
            while ((m = uriRegex.exec(lineText)) !== null) {
              const uStart = line.from + m.index;
              const uEnd = uStart + m[0].length;
              if (uStart < uEnd) {
                builder.add(uStart, uEnd, Decoration.mark({ class: 'cm-detected-uri' }));
              }
            }
          }
          if (line.to >= view.state.doc.length) break;
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

interface KylrixWYSIWYGEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  parentId?: string;
  parentKind?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string | number;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  autoFocus?: boolean;
  showToolbar?: boolean;
}

class ObjectBlockWidget extends WidgetType {
  constructor(
    readonly raw: string,
    readonly payload: SecondaryObjectPayload,
    readonly onRemove?: (payload: SecondaryObjectPayload, raw: string) => void,
    readonly readOnly?: boolean
  ) {
    super();
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'kylrix-object-widget my-2.5 rounded-2xl bg-[#0A0908] border border-white/8 p-3 flex flex-col gap-2 select-none';
    container.contentEditable = 'false';

    const kind = this.payload.childKind;

    // For non-image blocks (voice, file, etc.), show a compact header
    if (kind !== 'image') {
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-2 border-b border-white/4 pb-2';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-2 min-w-0';

      const badge = document.createElement('span');
      badge.className = 'px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider bg-white/6 text-white/70';
      badge.textContent = this.payload.childKind || 'attached object';
      left.appendChild(badge);

      if (this.payload.label) {
        const label = document.createElement('span');
        label.className = 'text-xs font-bold text-white/90 font-satoshi truncate';
        label.textContent = this.payload.label;
        left.appendChild(label);
      }

      header.appendChild(left);

      if (!this.readOnly && this.onRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'w-6 h-6 rounded-lg bg-white/4 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 flex items-center justify-center transition-colors shrink-0 cursor-pointer';
        removeBtn.title = 'Remove attached object';
        removeBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onRemove?.(this.payload, this.raw);
        };
        header.appendChild(removeBtn);
      }

      container.appendChild(header);
    }

    // Body content renderer
    const body = document.createElement('div');
    body.className = 'pt-0.5';

    const bucket = this.payload.bucketId || (kind === 'voice' ? APPWRITE_CONFIG.BUCKETS.VOICE : APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE);

    if (kind === 'voice' || (kind === 'file' && this.payload.metadata?.mimeType?.toString().startsWith('audio/'))) {
      const audioWrapper = document.createElement('div');
      audioWrapper.className = 'w-full py-1';
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.className = 'w-full h-9 rounded-xl accent-[#6366F1]';
      audio.src = StorageService.getFileView(this.payload.childId, bucket).toString();
      audioWrapper.appendChild(audio);
      body.appendChild(audioWrapper);
    } else if (kind === 'image') {
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'relative group w-full flex items-center justify-center';

      const imgSrc = StorageService.getFileView(this.payload.childId, bucket).toString();
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = this.payload.label || 'Attached image';
      img.className = 'w-full max-h-[75vh] object-contain rounded-2xl bg-black/30 border border-white/6 cursor-pointer hover:opacity-95 transition-opacity';
      img.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('kylrix:open-unified-media', {
          detail: {
            src: imgSrc,
            type: 'image',
            title: this.payload.label || 'Image preview',
            fileId: this.payload.childId,
            bucketId: bucket,
          }
        }));
      };
      imgWrapper.appendChild(img);

      if (!this.readOnly && this.onRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'absolute top-3 right-3 w-7 h-7 rounded-xl bg-black/70 hover:bg-rose-500 text-white/80 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-lg backdrop-blur-md';
        removeBtn.title = 'Remove attached image';
        removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onRemove?.(this.payload, this.raw);
        };
        imgWrapper.appendChild(removeBtn);
      }

      body.appendChild(imgWrapper);
    } else {
      const fileUrl = this.payload.href || StorageService.getFileView(this.payload.childId, bucket).toString();
      const link = document.createElement('a');
      link.href = fileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'inline-flex items-center gap-2 text-xs font-bold text-[#6366F1] hover:underline cursor-pointer';
      link.textContent = `Open ${this.payload.label || 'attachment'} ↗`;
      link.onclick = (e) => {
        const isPdf = Boolean(this.payload.metadata?.mimeType?.toString().includes('pdf') || this.payload.label?.toLowerCase().endsWith('.pdf'));
        if (isPdf) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('kylrix:open-unified-media', {
            detail: {
              src: fileUrl,
              type: 'pdf',
              title: this.payload.label || 'Document preview',
              fileId: this.payload.childId,
              bucketId: bucket,
            }
          }));
        }
      };
      body.appendChild(link);
    }

    container.appendChild(body);
    return container;
  }

  ignoreEvent() {
    return false;
  }
}

export function KylrixWYSIWYGEditor({
  value,
  onChange,
  parentId,
  parentKind: _parentKind = 'note',
  placeholder = 'Write in markdown…',
  readOnly = false,
  minHeight = '240px',
  className = '',
  onKeyDown,
  autoFocus = false,
  showToolbar: _showToolbar = true,
}: KylrixWYSIWYGEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmittedValueRef = useRef(value);
  const isExternalSyncRef = useRef(false);
  const lastEditAtRef = useRef(0);

  const handleRemoveObject = useCallback(
    async (payload: SecondaryObjectPayload, rawBlock: string) => {
      if (readOnly) return;

      const current = viewRef.current?.state.doc.toString() || value;
      const next = current.replace(rawBlock, '').trim();

      // Dispatch change to editor state
      if (viewRef.current) {
        const tr = viewRef.current.state.update({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: next },
        });
        viewRef.current.dispatch(tr);
      }
      onChange(next);

      // Trigger server detachment & secondary storage hard delete
      if (parentId && payload.childId) {
        try {
          await detachObjectByRelation({
            parentId,
            childId: payload.childId,
            childKind: payload.childKind,
            isSecondary: Boolean(payload.isSecondary),
            bucketId: payload.bucketId,
          });
          toast.success('Attached object removed');
        } catch (err: any) {
          console.warn('[WYSIWYG] Could not detach relation from server:', err);
        }
      }
    },
    [readOnly, value, onChange, parentId]
  );

  // Initialize CodeMirror 6 View
  useEffect(() => {
    if (!containerRef.current) return;

    const customTheme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: '#FFFFFF',
        fontFamily: 'inherit',
        fontSize: '15px',
      },
      '.cm-content': {
        padding: '8px 0',
        lineHeight: '1.75',
        caretColor: '#6366F1',
      },
      '.cm-line': {
        padding: '0.15em 0',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-placeholder': {
        color: 'rgba(155, 150, 145, 0.45)',
        fontStyle: 'normal',
      },
      '.cm-link, .cm-url, .cm-detected-uri': {
        color: '#818CF8 !important',
        textDecoration: 'underline !important',
        textUnderlineOffset: '2px',
      },
      '.cm-detected-uri:hover': {
        color: '#A5B4FC !important',
      },
      '.cm-env-key': {
        color: '#F59E0B !important',
        fontFamily: 'var(--font-mono, monospace)',
        fontWeight: '700',
      },
      '.cm-env-eq': {
        color: 'rgba(255, 255, 255, 0.45) !important',
        fontFamily: 'var(--font-mono, monospace)',
        fontWeight: '600',
      },
      '.cm-env-val': {
        color: '#34D399 !important',
        fontFamily: 'var(--font-mono, monospace)',
      },
    });

    const objectBlockField = StateField.define<DecorationSet>({
      create(state) {
        return buildDecorations(state.doc.toString());
      },
      update(decorations, tr) {
        if (tr.docChanged) {
          return buildDecorations(tr.state.doc.toString());
        }
        return decorations.map(tr.changes);
      },
      provide: (f) => EditorView.decorations.from(f),
    });

    function buildDecorations(docText: string): DecorationSet {
      const widgets: Range<Decoration>[] = [];
      const blocks = parseObjectBlocks(docText);

      for (const block of blocks) {
        const deco = Decoration.replace({
          widget: new ObjectBlockWidget(block.raw, block.payload, handleRemoveObject, readOnly),
          inclusive: false,
        });
        widgets.push(deco.range(block.start, block.end));
      }

      return Decoration.set(widgets, true);
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(liveMarkdownHighlight),
        liveMarkdownMarkHider,
        envAndUriDecorationPlugin,
        cmPlaceholder(placeholder),
        customTheme,
        objectBlockField,
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (isExternalSyncRef.current) return;
          if (update.docChanged) {
            lastEditAtRef.current = Date.now();
            const isUserChange = update.transactions.some(
              (tr) =>
                tr.isUserEvent('input') ||
                tr.isUserEvent('delete') ||
                tr.isUserEvent('undo') ||
                tr.isUserEvent('redo') ||
                tr.isUserEvent('drop') ||
                tr.isUserEvent('paste')
            );
            const str = update.state.doc.toString();
            lastEmittedValueRef.current = str;
            if (isUserChange) {
              onChange(str);
            }
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (onKeyDown) onKeyDown(event);
            return false;
          },
          click: (event) => {
            const target = event.target as HTMLElement;
            if (target?.classList?.contains('cm-detected-uri')) {
              const url = target.textContent?.trim();
              if (url && /^https?:\/\//i.test(url)) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Run once on mount

  // Sync external value changes to CodeMirror (e.g. initial load, resets, external insertions)
  useEffect(() => {
    if (!viewRef.current) return;
    if (value === lastEmittedValueRef.current) return;

    // Guard: Don't clobber if editor is focused and user actively typed within last 2500ms
    if (viewRef.current.hasFocus && Date.now() - lastEditAtRef.current < 2500) {
      return;
    }

    const currentDoc = viewRef.current.state.doc.toString();
    if (value !== currentDoc) {
      lastEmittedValueRef.current = value;
      isExternalSyncRef.current = true;
      try {
        const sel = viewRef.current.state.selection;
        const validSel = sel.main.to <= value.length ? sel : undefined;
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
          selection: validSel,
        });
      } finally {
        isExternalSyncRef.current = false;
      }
    }
  }, [value]);

  return (
    <div className={`kylrix-wysiwyg-wrapper flex flex-col w-full ${className}`}>
      <div
        ref={containerRef}
        style={{ minHeight }}
        className="kylrix-cm-container w-full flex-1 focus:outline-none"
      />
    </div>
  );
}
