'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { Notes } from '@/types/appwrite';
import { 
  Shield,
  KeyRound,
  ListTodo,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Clock,
  ArrowLeft,
  Check,
  Copy,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { NoteContentRenderer } from '@/components/NoteContentRenderer';
import { 
  realtime,
  APPWRITE_DATABASE_ID
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import CommentsSection from '@/app/(app)/note/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/note/(app)/notes/NoteReactions';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';

import { getEcosystemUrl } from '@/constants/ecosystem';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { decryptGhostData, decryptGhostBinaryFromBytes } from '@/lib/encryption/ghost-crypto';
import { storage } from '@/lib/appwrite/client';
import { isSendObjectMeta, parseSendGhostMetadata } from '@/lib/send/metadata';
import { sharedNotePublicUrl } from '@/lib/send/shared-note-api';
import type { SendFilePayload, SendKind, SendPasswordPayload, SendTaskPayload, SendTotpPayload } from '@/lib/send/types';
import { generateTOTP } from '@/lib/totp-util';
import { getEffectiveDisplayName } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';

const PRIMARY = '#6366F1';

const KIND_COLORS: Record<string, string> = {
  note: '#EC4899',       // Pink
  password: '#10B981',   // Green
  totp: '#10B981',       // Green
  task: '#A855F7',       // Purple
  discussion: '#F59E0B', // Amber
  file: '#6366F1',       // Indigo
};

interface Props {
  noteId: string;
  keyParam?: string;
  initialNote?: Notes | null;
}

export function SendReceiveClient({ noteId, keyParam, initialNote }: Props) {
  const router = useRouter();
  const [verifiedNote, setVerifiedNote] = useState<Notes | null>(initialNote || null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(!initialNote);
  const { user } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const { showSuccess } = useToast();
  
  // Send Specific State
  const [kind, setKind] = useState<SendKind | null>(null);
  const [plainTitle, setPlainTitle] = useState('');
  const [plainContent, setPlainContent] = useState('');
  const [passwordPayload, setPasswordPayload] = useState<SendPasswordPayload | null>(null);
  const [totpPayload, setTotpPayload] = useState<SendTotpPayload | null>(null);
  const [taskPayload, setTaskPayload] = useState<SendTaskPayload | null>(null);
  const [fileManifest, setFileManifest] = useState<SendFilePayload | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [, setTextPreview] = useState<string | null>(null);

  const themeColor = KIND_COLORS[kind || 'note'] || PRIMARY;
  const [totpLive, setTotpLive] = useState('');
  const [showPw, setShowPw] = useState(false);

  const hasKey = Boolean(keyParam?.trim());

  const tickTotp = useCallback((secret: string) => {
    try {
      const normalized = secret.replace(/\s+/g, '').toUpperCase();
      const code = generateTOTP(normalized);
      setTotpLive(code);
    } catch {
      setTotpLive('—');
    }
  }, []);

  const parseMeta = useCallback((note: Notes) => {
    try {
      return parseSendGhostMetadata(note.metadata);
    } catch {
      return {};
    }
  }, []);

  const decryptData = useCallback(async (note: Notes) => {
    const meta = parseMeta(note);
    const isEncrypted = note.isEncrypted === true || (meta as any).isEncrypted;

    if (!isEncrypted) {
      return {
        title: note.title || '',
        content: note.content || ''
      };
    }

    if (!hasKey) {
      throw new Error('This send link is encrypted and requires a valid decryption key in the URL.');
    }

    const dk = keyParam!.trim();
    
    // Support both Legacy T4 and new Ghost encryption
    if ((meta as any).encryptionVersion === 'T4') {
        const keyBuffer = ecosystemSecurity.decodeBase64(dk);
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBuffer as any,
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt']
        );
        return {
            title: await ecosystemSecurity.decryptWithKey((meta as any).encryptedTitle || note.title || '', cryptoKey),
            content: await ecosystemSecurity.decryptWithKey(note.content || '', cryptoKey),
        };
    }

    return {
      title: await decryptGhostData(note.title || '', dk),
      content: await decryptGhostData(note.content || '', dk),
    };
  }, [keyParam, hasKey, parseMeta]);

  const processPolymorphicPayload = useCallback(async (note: Notes, plainContent: string, isEncrypted: boolean) => {
    const meta = parseMeta(note);
    if (!isSendObjectMeta(meta)) return;

    const dk = keyParam?.trim() || '';

    switch (meta.send_object.kind) {
      case 'password': {
        try {
          const parsed = JSON.parse(plainContent) as SendPasswordPayload;
          setPasswordPayload(parsed);
          if (parsed.totpSecret) tickTotp(parsed.totpSecret);
        } catch { throw new Error('Invalid password payload.'); }
        break;
      }
      case 'totp': {
        try {
          const parsed = JSON.parse(plainContent) as SendTotpPayload;
          setTotpPayload(parsed);
          tickTotp(parsed.secret);
        } catch { throw new Error('Invalid TOTP payload.'); }
        break;
      }
      case 'task': {
        try { setTaskPayload(JSON.parse(plainContent)); } catch { throw new Error('Invalid task payload.'); }
        break;
      }
      case 'file': {
        try {
          let manifest = JSON.parse(plainContent) as SendFilePayload;
          const bucketId = meta.send_object?.bucketId || manifest.bucketId;
          const fileId = meta.send_object?.fileId || manifest.fileId;
          if (!bucketId || !fileId) throw new Error('Incomplete file manifest.');
          manifest = { ...manifest, bucketId, fileId };

          const downloadUrl = storage.getFileDownload(bucketId, fileId);
          const fileRes = await fetch(downloadUrl);
          if (!fileRes.ok) throw new Error('Could not download file.');
          const fileBuf = await fileRes.arrayBuffer();
          const plainBuf = isEncrypted ? decryptGhostBinaryFromBytes(fileBuf, dk) : fileBuf;
          const blob = new Blob([plainBuf], { type: manifest.mimeType || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          setFileManifest(manifest);
          setFileBlobUrl(url);
          const mime = manifest.mimeType || '';
          if (mime.startsWith('text/') || mime === 'application/json') {
            try { setTextPreview(new TextDecoder().decode(plainBuf)); } catch { setTextPreview(null); }
          }
        } catch (e: any) { throw new Error(`File processing failed: ${e.message}`); }
        break;
      }
    }
  }, [keyParam, parseMeta, tickTotp]);

  const fetchNote = useCallback(async (force: boolean = false) => {
    setIsLoadingNote(true);
    setError(null);
    try {
      const url = sharedNotePublicUrl(noteId);
      const res = await fetch(url, { cache: 'no-store' });
      const contentType = res.headers.get('content-type');
      
      if (!res.ok) {
        if (contentType?.includes('application/json')) {
            const body = await res.json();
            throw new Error(body.error || 'Could not load link.');
        }
        throw new Error(`Server returned error (${res.status}).`);
      }

      if (!contentType?.includes('application/json')) {
          throw new Error('Server returned an invalid response format (Expected JSON).');
      }

      const note = await res.json() as Notes;
      const meta = parseMeta(note);

      if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
        throw new Error('This send link has expired.');
      }

      const isEncrypted = note.isEncrypted === true || (meta as any).isEncrypted;
      const { title, content } = await decryptData(note);

      setVerifiedNote(note);
      setPlainTitle(title);
      setPlainContent(content);
      setKind(meta.send_object?.kind || 'note');

      await processPolymorphicPayload(note, content, isEncrypted);

      if (note.userId) {
          try {
            const { getSharedProfilesSecure } = await import('@/lib/actions/secure-ops');
            const profilesRes = await getSharedProfilesSecure([note.userId]);
            const author = profilesRes.documents?.[0];
            if (author) setAuthorProfile(author as any);
          } catch (profileErr) {
            console.warn('Failed to resolve author profile:', profileErr);
          }
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the link.');
    } finally {
      setIsLoadingNote(false);
    }
  }, [noteId, parseMeta, decryptData, processPolymorphicPayload]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  useEffect(() => {
    let mounted = true;
    const resolveAuthorAvatar = async () => {
      if (!authorProfile) return;
      const rawAvatar = authorProfile.avatar || authorProfile.profilePicId || null;
      if (!rawAvatar) return;
      const cached = getCachedProfilePreview(rawAvatar);
      if (cached !== undefined) {
        if (mounted) setAuthorAvatarUrl(cached);
        return;
      }
      try {
        const preview = await fetchProfilePreview(rawAvatar, 64, 64);
        if (mounted) setAuthorAvatarUrl(preview);
      } catch {
        if (mounted) setAuthorAvatarUrl(null);
      }
    };
    resolveAuthorAvatar();
    return () => { mounted = false; };
  }, [authorProfile]);

  // Realtime
  useEffect(() => {
    if (!noteId) return;
    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_CONFIG.DATABASES.NOTE}.notes.documents.${noteId}`;
    const sub = realtime.subscribe(channel, (response) => {
      if (response.events.some(e => e.endsWith('.delete'))) {
        setError('This link has been deleted or expired.');
        setVerifiedNote(null);
      } else if (response.events.some(e => e.endsWith('.update'))) {
          fetchNote(true);
      }
    });
    return () => { if (typeof sub === 'function') (sub as any)(); };
  }, [noteId, fetchNote]);

  useEffect(() => {
    const secret = passwordPayload?.totpSecret || totpPayload?.secret || null;
    if (!secret) return;
    tickTotp(secret);
    const id = window.setInterval(() => tickTotp(secret), 1000);
    return () => window.clearInterval(id);
  }, [passwordPayload?.totpSecret, totpPayload?.secret, tickTotp]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('Copied to clipboard');
    } catch {
      // Ignored
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(plainContent || '');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!verifiedNote) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center p-4">
        <div className="max-w-[400px] w-full text-center">
          <h5 className="text-xl font-black mb-2 font-clash text-white">
            {isLoadingNote ? 'Opening Send Link' : 'Cannot open link'}
          </h5>
          {error ? (
            <div className="mt-4">
              <p className="text-xs text-white/50 mb-6">{error}</p>
              <button
                onClick={() => fetchNote(true)}
                className="rounded-xl px-6 py-2.5 font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                Retry
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/50 mb-6">Fetching the payload. Please wait.</p>
          )}
          {isLoadingNote && (
            <div className="flex justify-center mt-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: themeColor }}></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const meta = parseMeta(verifiedNote);
  const isEncrypted = verifiedNote.isEncrypted === true || (meta as any).isEncrypted;

  const NoteContent = () => {
    return (
      <div className="rounded-[32px] border border-white/5 bg-[#161412] overflow-hidden text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.05)]">
        <div className="p-8 md:p-12 border-b border-white/[0.03] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-lg grid place-items-center border"
                style={{
                  backgroundColor: `${isEncrypted ? themeColor : '#10B981'}1a`,
                  borderColor: `${isEncrypted ? themeColor : '#10B981'}4d`,
                  color: isEncrypted ? themeColor : '#10B981'
                }}
              >
                {kind === 'password' ? <KeyRound size={20} /> : kind === 'totp' ? <Shield size={20} /> : kind === 'file' ? <Upload size={20} /> : kind === 'task' ? <ListTodo size={20} /> : <FileText size={20} />}
              </div>
              <div>
                <h4 className="text-2xl font-black font-clash leading-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  {kind === 'file' ? fileManifest?.originalName || plainTitle || 'File' : plainTitle || 'Untitled'}
                </h4>
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mt-1">
                  {kind} · {isEncrypted ? 'Private' : 'Preview'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-bold border"
                style={{
                  backgroundColor: `${isEncrypted ? themeColor : '#10B981'}1a`,
                  color: isEncrypted ? themeColor : '#10B981',
                  borderColor: `${isEncrypted ? themeColor : '#10B981'}33`,
                }}
              >
                {isEncrypted ? <Lock size={12} /> : <Unlock size={12} />}
                <span>{isEncrypted ? "Secure" : "Open"}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-white/40">
              <Clock size={14} />
              <span className="text-xs font-bold font-satoshi">
                Vanish {new Date(meta.expiresAt || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <Eye size={14} />
              <span className="text-xs font-bold font-satoshi">Link Active</span>
            </div>

            {authorProfile && (
              <a 
                href={authorProfile.username ? `${getEcosystemUrl('connect')}/u/${authorProfile.username}` : '#'} 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1C1A18] py-1 px-3 rounded-xl border border-white/5 transition duration-300 hover:bg-[#252220] hover:translate-y-[-1px]"
              >
                {authorAvatarUrl ? (
                  <img 
                    src={authorAvatarUrl} 
                    alt={getEffectiveDisplayName(authorProfile)}
                    className="w-5 h-5 rounded-full object-cover" 
                  />
                ) : (
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
                    style={{ backgroundColor: themeColor }}
                  >
                    {getEffectiveDisplayName(authorProfile)[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-black font-satoshi" style={{ color: themeColor }}>
                  {authorProfile.username ? `@${authorProfile.username}` : getEffectiveDisplayName(authorProfile)}
                </span>
              </a>
            )}
          </div>
        </div>

        <div className="relative p-8 md:p-12 bg-black/10">
          {kind === 'password' && passwordPayload && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#9B9691] font-satoshi font-bold">Username / URL</label>
                <input 
                  type="text" 
                  value={passwordPayload.username || '—'} 
                  readOnly 
                  className="w-full bg-black border border-[#34322F] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#9B9691] font-satoshi font-bold">Password</label>
                <div className="relative">
                  <input 
                    type={showPw ? 'text' : 'password'} 
                    value={passwordPayload.password} 
                    readOnly 
                    className="w-full bg-black border border-[#34322F] rounded-xl px-4 py-3 pr-12 text-white font-mono text-sm focus:outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPw(!showPw)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => copy('pw', passwordPayload.password)} 
                className="w-full py-3.5 rounded-[14px] font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                Copy Password
              </button>
              {passwordPayload.totpSecret && (
                <div className="p-6 rounded-2xl bg-black border border-[#34322F] text-center">
                  <span className="text-[10px] text-[#9B9691] font-bold tracking-wider block mb-1">AUTHENTICATOR CODE</span>
                  <span className="font-mono text-4xl font-black tracking-widest text-white">{totpLive}</span>
                </div>
              )}
            </div>
          )}

          {kind === 'totp' && totpPayload && (
            <div className="flex flex-col gap-6">
              <div className="p-8 rounded-2xl bg-black border border-[#34322F] text-center">
                <span className="text-[10px] text-[#9B9691] font-bold tracking-wider block mb-1">CURRENT CODE</span>
                <span className="font-mono text-5xl font-black tracking-[0.2em] text-white block pl-[0.2em]">{totpLive}</span>
                <span className="mt-4 text-sm text-white/40 block">{totpPayload.issuer || 'Unknown Issuer'}</span>
              </div>
              <button 
                onClick={() => copy('secret', totpPayload.secret)} 
                className="w-full py-3.5 rounded-[14px] font-bold border border-[#34322F] text-white hover:bg-white/5 active:scale-[0.98] transition"
              >
                Copy Secret Key
              </button>
            </div>
          )}

          {kind === 'task' && taskPayload && (
            <div className="flex flex-col gap-4">
              <h5 className="text-xl font-bold text-white">{taskPayload.title}</h5>
              <p className="text-white/70 whitespace-pre-wrap leading-relaxed">{taskPayload.detail || 'No description provided.'}</p>
              {taskPayload.dueAt && (
                <span className="self-start px-2.5 py-1 text-xs rounded-lg font-bold bg-white/5 text-white/70 border border-white/5">
                  Due: {new Date(taskPayload.dueAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {kind === 'file' && fileManifest && fileBlobUrl && (
            <div className="flex flex-col gap-6">
              <div className="p-6 rounded-2xl bg-black border border-[#34322F] flex items-center gap-4">
                <Upload size={24} style={{ color: themeColor }} />
                <div>
                  <p className="font-bold text-white">{fileManifest.originalName}</p>
                  <span className="text-xs text-white/40">
                    {fileManifest.size >= 1024 * 1024 ? `${(fileManifest.size / (1024 * 1024)).toFixed(2)} MB` : `${(fileManifest.size / 1024).toFixed(1)} KB`} · {fileManifest.mimeType}
                  </span>
                </div>
              </div>
              <a 
                href={fileBlobUrl} 
                download={fileManifest.originalName} 
                className="w-full py-4 text-center rounded-[14px] font-bold text-black block transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}
              >
                Download Decrypted File
              </a>
              {fileManifest.mimeType?.startsWith('image/') && (
                <img src={fileBlobUrl} alt="Decrypted view" className="max-w-full rounded-2xl border border-[#34322F]" />
              )}
            </div>
          )}

          {kind === 'note' && (
            <div className="relative">
              <button
                onClick={handleCopyContent}
                className="absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center border rounded-xl transition duration-200 z-10 hover:bg-[#252220] hover:text-white"
                style={{
                  backgroundColor: isCopied ? `${themeColor}1a` : '#1C1A18',
                  borderColor: isCopied ? themeColor : 'rgba(255, 255, 255, 0.05)',
                  color: isCopied ? themeColor : 'rgba(255, 255, 255, 0.4)'
                }}
              >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <NoteContentRenderer
                content={plainContent}
                format={verifiedNote.format || 'text'}
                emptyFallback={<span className="text-white/20 italic text-sm">This payload is empty.</span>}
              />
            </div>
          )}
        </div>

        <div className="p-6 bg-[#161412] border-t border-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30 font-mono font-bold">
              LINK ID: {verifiedNote.$id.toUpperCase()}
            </span>
            <span className="text-[10px] font-black tracking-wider uppercase font-clash" style={{ color: themeColor }}>
              SECURE LINK · KYLRIX
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0908] text-white">
      {/* Top Header */}
      <header className="bg-[#0E0C0A] border-b border-[#1C1A18] h-[88px] flex items-center fixed top-0 left-0 right-0 z-[100] px-4 md:px-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4">
          <p className="text-sm text-white/50 font-semibold">
            {isEncrypted ? 'This link is protected by encryption.' : 'You are viewing a public preview of a shared item.'}
          </p>
          <NextLink 
            href="/send" 
            className="font-bold flex items-center gap-2 transition hover:opacity-85 text-sm"
            style={{ color: themeColor }}
          >
            <ArrowLeft size={16} />
            <span>Back to Send</span>
          </NextLink>
        </div>
      </header>

      {kind === 'discussion' ? (
        <HuddleChatWindow
          chatNoteId={noteId}
          user={user}
          title={plainTitle || 'Discussion Huddle'}
          standalone={true}
          onBack={() => router.push('/send')}
          expiresAt={meta.expiresAt}
          shareLink={typeof window !== 'undefined' ? window.location.href : ''}
        />
      ) : (
        <main className="max-w-4xl mx-auto px-4 md:px-0 pt-[128px] pb-16">
          <NoteContent />

          <div className="mt-8">
            <NoteReactions targetId={noteId} />
          </div>

          <div className="mt-8">
            <CommentsSection noteId={noteId} decryptionKey={keyParam} />
          </div>

          <div className="mt-16 text-center">
            <div className="p-12 rounded-[32px] bg-[#161412] border border-[#6366F1]/10 shadow-[0_20px_40px_rgba(0,0,0,0.4),_inset_0_1px_0_rgba(255,255,255,0.02)]">
              <h4 className="text-3xl font-black mb-4 font-clash text-white">
                Create Your Own Notes
              </h4>
              <p className="text-white/60 mb-8 max-w-[500px] mx-auto">
                Join thousands of users who trust Kylrix Note to capture, organize, and share their thoughts.
              </p>
              <NextLink
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-black font-black transition hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ 
                  backgroundColor: themeColor,
                  boxShadow: `0 8px 24px ${themeColor}33`,
                }}
              >
                <span>Start Writing for Free</span>
                <ArrowRight size={18} />
              </NextLink>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
