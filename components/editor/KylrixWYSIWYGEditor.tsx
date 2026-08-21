'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder, WidgetType, Decoration, DecorationSet } from '@codemirror/view';
import { EditorState, StateField, Range } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { parseObjectBlocks, serializeObjectBlock, type SecondaryObjectPayload } from '@/lib/note-object-secondary';
import { Mic, Paperclip, Loader2 } from 'lucide-react';
import { StorageService } from '@/lib/services/storage';
import { attachObject, detachObjectByRelation } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useAuth } from '@/context/auth/AuthContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import toast from 'react-hot-toast';

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

    const kind = this.payload.childKind;
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
        if (this.payload.childKind === 'pdf' || this.payload.metadata?.mimeType?.toString().includes('pdf')) {
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
  parentKind = 'note',
  placeholder = 'Write in markdown…',
  readOnly = false,
  minHeight = '240px',
  className = '',
  onKeyDown,
  autoFocus = false,
  showToolbar = true,
}: KylrixWYSIWYGEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalUpdateRef = useRef(false);

  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<any>(null);

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
        color: 'rgba(255, 255, 255, 0.92)',
        fontFamily: 'inherit',
        fontSize: '15px',
      },
      '.cm-content': {
        padding: '8px 0',
        lineHeight: '1.75',
        caretColor: '#6366F1',
      },
      '.cm-line': {
        padding: '0',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-placeholder': {
        color: 'rgba(155, 150, 145, 0.45)',
        fontStyle: 'normal',
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
        cmPlaceholder(placeholder),
        customTheme,
        objectBlockField,
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            isInternalUpdateRef.current = true;
            const str = update.state.doc.toString();
            onChange(str);
            isInternalUpdateRef.current = false;
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (onKeyDown) onKeyDown(event);
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

  // Sync external value changes to CodeMirror
  useEffect(() => {
    if (!viewRef.current || isInternalUpdateRef.current) return;
    const currentDoc = viewRef.current.state.doc.toString();
    if (value !== currentDoc) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  const insertTextAtCursor = useCallback((textToInsert: string) => {
    if (!viewRef.current) return;
    const { from, to } = viewRef.current.state.selection.main;
    viewRef.current.dispatch({
      changes: { from, to, insert: textToInsert },
      selection: { anchor: from + textToInsert.length },
    });
    viewRef.current.focus();
  }, []);

  // Voice recording flow
  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!hasPaidKylrixPlan(user)) {
        openProUpgrade('Voice recording');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options = { audioBitsPerSecond: 16000 };
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          (options as any).mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          (options as any).mimeType = 'audio/ogg;codecs=opus';
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());

          try {
            setIsUploading(true);
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');

            // Attach object relation if parentId exists
            let objectId: string | undefined;
            if (parentId) {
              try {
                const relation = await attachObject({
                  parentId,
                  parentKind,
                  childId: uploaded.$id,
                  childKind: 'voice',
                  metadata: {
                    isSecondary: true,
                    filename: audioFile.name,
                    mimeType: audioFile.type,
                    size: audioFile.size,
                    duration: recordingDuration,
                  },
                });
                objectId = relation?.$id;
              } catch {}
            }

            const block = serializeObjectBlock({
              objectId,
              childId: uploaded.$id,
              childKind: 'voice',
              bucketId: 'voice',
              label: `Voice note (${recordingDuration}s)`,
              isSecondary: true,
              metadata: { duration: recordingDuration },
            });

            insertTextAtCursor(`\n\n${block}\n\n`);
            toast.success('Voice note recorded and attached');
          } catch (err: any) {
            console.error('Failed to upload voice note:', err);
            toast.error('Could not save voice note');
          } finally {
            setIsUploading(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone error:', err);
        toast.error('Microphone access is required to record voice notes');
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (!hasPaidKylrixPlan(user)) {
      openProUpgrade('File upload');
      return;
    }

    try {
      setIsUploading(true);
      const bucketId = APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE;
      const uploaded = await StorageService.uploadFile(file, bucketId);
      const childKind = file.type.startsWith('image/') ? 'image' : 'file';

      let objectId: string | undefined;
      if (parentId) {
        try {
          const relation = await attachObject({
            parentId,
            parentKind,
            childId: uploaded.$id,
            childKind,
            metadata: {
              isSecondary: true,
              bucketId,
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
            },
          });
          objectId = relation?.$id;
        } catch {}
      }

      const block = serializeObjectBlock({
        objectId,
        childId: uploaded.$id,
        childKind: childKind as any,
        bucketId,
        label: file.name,
        isSecondary: true,
        metadata: { mimeType: file.type, fileName: file.name },
      });

      insertTextAtCursor(`\n\n${block}\n\n`);
      toast.success('File attached');
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Failed to attach file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`kylrix-wysiwyg-wrapper flex flex-col w-full ${className}`}>
      {showToolbar && !readOnly && (
        <div className="flex items-center justify-between gap-2 px-1 py-1.5 border-b border-white/6 mb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isUploading}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold font-satoshi flex items-center gap-1.5 transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-white/4 hover:bg-white/8 text-white/70 hover:text-white border border-white/4'
              }`}
            >
              <Mic size={14} className={isRecording ? 'text-rose-400' : 'text-[#6366F1]'} />
              <span>{isRecording ? `Recording (${recordingDuration}s)` : 'Voice Note'}</span>
            </button>

            <label className="px-2.5 py-1.5 rounded-xl text-xs font-bold font-satoshi flex items-center gap-1.5 bg-white/4 hover:bg-white/8 text-white/70 hover:text-white border border-white/4 transition-all cursor-pointer">
              <Paperclip size={14} className="text-white/50" />
              <span>Attach File</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>

            {isUploading && (
              <div className="flex items-center gap-1 text-[11px] text-white/40 pl-2">
                <Loader2 size={12} className="animate-spin text-[#6366F1]" />
                <span>Uploading…</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ minHeight }}
        className="kylrix-cm-container w-full flex-1 focus:outline-none"
      />
    </div>
  );
}
