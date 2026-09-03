'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  Share2, 
  QrCode, 
  Mail, 
  X,
  Globe,
  FileText,
  Download
} from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { executeInstantShare } from '@/lib/share/instant-share';
import { PublicResourceType } from '@/lib/share/resource-types';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { account } from '@/lib/appwrite/client';
import { exportToMarkdown, exportToICS } from '@/lib/utils/export';
import toast from 'react-hot-toast';

export interface ShareContextData {
  resourceType: PublicResourceType;
  resourceId: string;
  resourceTitle?: string;
  isPublic?: boolean;
  isGuest?: boolean;
  dek?: string | null;
  projectId?: string;
  accentColor?: string;
  content?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface ShareActionItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
  execute: (url: string, title: string) => Promise<void> | void;
}

const WhatsAppIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TelegramIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.942z" />
  </svg>
);

const XIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const SETTINGS_STORAGE_KEY = 'kylrix_share_preferences_v1';
const PREFS_KEY = 'share_methods_order';

async function getFrequentShareMethods(userId?: string | null): Promise<string[]> {
  try {
    const cached = await LocalEngine.cacheGet<string[]>(SETTINGS_STORAGE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  } catch {}

  if (userId) {
    try {
      const prefs = await account.getPrefs().catch(() => null);
      if (prefs?.[PREFS_KEY]) {
        const parsed = JSON.parse(prefs[PREFS_KEY]);
        if (Array.isArray(parsed)) {
          void LocalEngine.cacheSet(SETTINGS_STORAGE_KEY, parsed);
          return parsed;
        }
      }
    } catch {}
  }

  return ['copy', 'copyText', 'download', 'whatsapp', 'telegram', 'x', 'native'];
}

async function recordShareMethodUsage(methodId: string, userId?: string | null): Promise<void> {
  try {
    const current = await getFrequentShareMethods(userId);
    const updated = [methodId, ...current.filter((id) => id !== methodId)].slice(0, 10);
    
    await LocalEngine.cacheSet(SETTINGS_STORAGE_KEY, updated);

    if (userId) {
      void (async () => {
        try {
          const prefs = await account.getPrefs().catch(() => ({}));
          await account.updatePrefs({
            ...prefs,
            [PREFS_KEY]: JSON.stringify(updated),
          }).catch(() => {});
        } catch {}
      })();
    }
  } catch {}
}

async function resolveObjectContent(
  resourceType: PublicResourceType,
  resourceId: string,
  providedContent?: string,
  meta?: { title?: string; startTime?: string; endTime?: string; location?: string }
): Promise<{ text: string; markdown: string; title: string }> {
  let title = meta?.title || `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;
  let content = providedContent || '';

  if (!content && resourceId && typeof window !== 'undefined') {
    try {
      if (resourceType === 'note') {
        const cached = (await LocalEngine.cacheGet<{ rows: any[] }>('f_ideas_all')) || (await LocalEngine.cacheGet<{ rows: any[] }>('f_ideas_guest'));
        const item = cached?.rows?.find((r: any) => r.$id === resourceId);
        if (item) {
          title = item.title || title;
          content = item.content || '';
        }
      } else if (resourceType === 'moment') {
        const cached = localStorage.getItem('kylrix_nostr_feed_cache');
        if (cached) {
          const events = JSON.parse(cached);
          const ev = events.find((e: any) => e.id === resourceId.replace(/^nostr_/, ''));
          if (ev) {
            content = ev.content || '';
          }
        }
      } else if (resourceType === 'goal' || resourceType === 'task') {
        const cached = await LocalEngine.cacheGet<{ rows: any[] }>('f_goals_all');
        const item = cached?.rows?.find((r: any) => r.$id === resourceId);
        if (item) {
          title = item.title || title;
          content = item.description || item.content || '';
        }
      } else if (resourceType === 'event') {
        const cached = await LocalEngine.cacheGet<{ rows: any[] }>('f_events_all');
        const item = cached?.rows?.find((r: any) => r.$id === resourceId);
        if (item) {
          title = item.title || title;
          content = item.description || '';
        }
      }
    } catch { /* fallback to provided */ }
  }

  let markdown = '';
  let text = '';

  if (resourceType === 'event') {
    text = `Event: ${title}\n${meta?.startTime ? `Date: ${new Date(meta.startTime).toLocaleString()}\n` : ''}${meta?.location ? `Location: ${meta.location}\n` : ''}\n${content}`;
    markdown = `# ${title}\n\n**Date:** ${meta?.startTime ? new Date(meta.startTime).toLocaleString() : 'N/A'}\n${meta?.location ? `**Location:** ${meta.location}\n` : ''}\n${content}`;
  } else if (resourceType === 'goal' || resourceType === 'task') {
    text = `Goal: ${title}\n\n${content}`;
    markdown = `# Goal: ${title}\n\n${content}`;
  } else {
    text = `${title}\n\n${content}`;
    markdown = `# ${title}\n\n${content}`;
  }

  return { text, markdown, title };
}

export function ShareContextDrawer() {
  const { drawerData, close, open } = useUnifiedDrawer();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isResolving, setIsResolving] = useState(true);
  const [methodOrder, setMethodOrder] = useState<string[]>(['copy', 'copyText', 'download', 'whatsapp', 'telegram', 'x', 'native']);
  const [showQR, setShowQR] = useState(false);

  const data: ShareContextData = drawerData || {
    resourceType: 'note',
    resourceId: '',
    resourceTitle: 'Untitled',
  };

  const { resourceType, resourceId, resourceTitle = '', dek, projectId, isPublic = true, isGuest = true, content, description, startTime, endTime, location } = data;
  const friendlyTitle = resourceTitle || `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;

  useEffect(() => {
    let active = true;
    async function init() {
      setIsResolving(true);
      try {
        const methods = await getFrequentShareMethods(user?.$id);
        if (active) setMethodOrder(methods);

        const res = await executeInstantShare(resourceType, resourceId, {
          dek,
          isPublic,
          isGuest,
          resourceTitle,
          projectId,
          openLoginDrawer: (ctx) => open('login', ctx),
          openMasterpassPrompt: () => open('masterpass'),
        });

        if (active && res.url) {
          setResolvedUrl(res.url);
        }
      } catch (err) {
        console.warn('[ShareContextDrawer] Error resolving share link:', err);
      } finally {
        if (active) setIsResolving(false);
      }
    }

    if (resourceId) {
      void init();
    }
    return () => {
      active = false;
    };
  }, [resourceType, resourceId, resourceTitle, dek, projectId, isPublic, isGuest, user?.$id, open]);

  const handleCopyLink = async () => {
    if (!resolvedUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedUrl);
        setCopied(true);
        toast.success('Link copied to clipboard');
        await recordShareMethodUsage('copy', user?.$id);
        setTimeout(() => {
          setCopied(false);
          close();
        }, 400);
      }
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyText = async () => {
    try {
      const resolved = await resolveObjectContent(resourceType, resourceId, content || description, {
        title: friendlyTitle,
        startTime,
        endTime,
        location,
      });
      const payload = resolved.text || resolved.markdown || friendlyTitle;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        setCopiedText(true);
        toast.success('Text copied to clipboard');
        await recordShareMethodUsage('copyText', user?.$id);
        setTimeout(() => {
          setCopiedText(false);
          close();
        }, 400);
      }
    } catch {
      toast.error('Failed to copy text');
    }
  };

  const handleDownload = async () => {
    try {
      const resolved = await resolveObjectContent(resourceType, resourceId, content || description, {
        title: friendlyTitle,
        startTime,
        endTime,
        location,
      });

      if (resourceType === 'event') {
        exportToICS(
          resolved.title,
          content || description || '',
          startTime || new Date().toISOString(),
          endTime
        );
        toast.success('Event (.ics) downloaded');
      } else {
        exportToMarkdown(resolved.title, resolved.markdown || content || description || '');
        toast.success('Markdown (.md) downloaded');
      }
      await recordShareMethodUsage('download', user?.$id);
      setTimeout(() => close(), 400);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const allActions: Record<string, ShareActionItem> = useMemo(() => ({
    copy: {
      id: 'copy',
      label: copied ? 'Copied' : 'Copy Link',
      sublabel: 'Direct link',
      icon: copied ? Check : Copy,
      color: copied ? 'text-[#10B981]' : 'text-white',
      bg: copied ? 'bg-[#10B981]/15' : 'bg-white/[0.04]',
      border: copied ? 'border-[#10B981]/40' : 'border-white/10',
      execute: handleCopyLink,
    },
    copyText: {
      id: 'copyText',
      label: copiedText ? 'Copied' : 'Copy Text',
      sublabel: 'Full text',
      icon: copiedText ? Check : FileText,
      color: copiedText ? 'text-[#10B981]' : 'text-emerald-400',
      bg: copiedText ? 'bg-[#10B981]/15' : 'bg-emerald-500/10',
      border: copiedText ? 'border-[#10B981]/40' : 'border-emerald-500/25',
      execute: handleCopyText,
    },
    download: {
      id: 'download',
      label: resourceType === 'event' ? 'Download .ics' : 'Download .md',
      sublabel: resourceType === 'event' ? 'Calendar file' : 'Markdown file',
      icon: Download,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      execute: handleDownload,
    },
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp',
      sublabel: 'Send chat',
      icon: WhatsAppIcon,
      color: 'text-[#25D366]',
      bg: 'bg-[#25D366]/10',
      border: 'border-[#25D366]/25',
      execute: (url, title) => {
        const text = encodeURIComponent(`${title}: ${url}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('whatsapp', user?.$id);
        setTimeout(() => close(), 300);
      },
    },
    telegram: {
      id: 'telegram',
      label: 'Telegram',
      sublabel: 'Send message',
      icon: TelegramIcon,
      color: 'text-[#229ED9]',
      bg: 'bg-[#229ED9]/10',
      border: 'border-[#229ED9]/25',
      execute: (url, title) => {
        const text = encodeURIComponent(title);
        const encodedUrl = encodeURIComponent(url);
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('telegram', user?.$id);
        setTimeout(() => close(), 300);
      },
    },
    x: {
      id: 'x',
      label: 'X (Twitter)',
      sublabel: 'Post link',
      icon: XIcon,
      color: 'text-white',
      bg: 'bg-white/[0.06]',
      border: 'border-white/15',
      execute: (url, title) => {
        const text = encodeURIComponent(`Check out "${title}" on @Kylrix:\n\n${url}`);
        window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('x', user?.$id);
        setTimeout(() => close(), 300);
      },
    },
    qr: {
      id: 'qr',
      label: 'QR Code',
      sublabel: 'Scan & open',
      icon: QrCode,
      color: 'text-[#A855F7]',
      bg: 'bg-[#A855F7]/10',
      border: 'border-[#A855F7]/25',
      execute: () => {
        setShowQR(true);
        void recordShareMethodUsage('qr', user?.$id);
      },
    },
    email: {
      id: 'email',
      label: 'Email',
      sublabel: 'Send by email',
      icon: Mail,
      color: 'text-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      border: 'border-[#F59E0B]/25',
      execute: (url, title) => {
        const subject = encodeURIComponent(`Shared with you: ${title}`);
        const body = encodeURIComponent(`Here is the link to "${title}":\n\n${url}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        void recordShareMethodUsage('email', user?.$id);
        setTimeout(() => close(), 300);
      },
    },
    native: {
      id: 'native',
      label: 'More',
      sublabel: 'System share',
      icon: Share2,
      color: 'text-[#6366F1]',
      bg: 'bg-[#6366F1]/10',
      border: 'border-[#6366F1]/25',
      execute: async (url, title) => {
        void recordShareMethodUsage('native', user?.$id);
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title,
              text: `Check out "${title}" on Kylrix`,
              url,
            });
            setTimeout(() => close(), 300);
          } catch (err: any) {
            if (err?.name !== 'AbortError') {
              toast.error('System share failed, link copied instead');
              await handleCopyLink();
            }
          }
        } else {
          toast('System share not supported on this browser, link copied!');
          await handleCopyLink();
        }
      },
    },
  }), [copied, copiedText, resourceType, resolvedUrl, user?.$id, close, handleCopyText, handleDownload]);

  const orderedActions = useMemo(() => {
    const defaultKeys = ['copy', 'copyText', 'download', 'whatsapp', 'telegram', 'x', 'qr', 'email', 'native'];
    const seen = new Set<string>();
    const result: ShareActionItem[] = [];

    // Always keep 'copy' pinned first
    if (allActions['copy']) {
      result.push(allActions['copy']);
      seen.add('copy');
    }

    // Append frequently used methods next
    for (const key of methodOrder) {
      if (allActions[key] && !seen.has(key) && key !== 'native') {
        result.push(allActions[key]);
        seen.add(key);
      }
    }

    // Append remaining actions
    for (const key of defaultKeys) {
      if (allActions[key] && !seen.has(key) && key !== 'native') {
        result.push(allActions[key]);
        seen.add(key);
      }
    }

    // Ensure Native/More is last
    if (allActions['native']) {
      result.push(allActions['native']);
    }

    return result;
  }, [allActions, methodOrder]);

  return (
    <div className="w-full bg-[#161412] text-[#F5F2ED] flex flex-col font-sans select-none pb-6">
      {/* Header with clear contextual title */}
      <div className="px-6 pb-4 pt-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/80 shrink-0">
            <Share2 size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold font-clash text-white truncate m-0">
              Share {friendlyTitle}
            </h3>
            <p className="text-[11px] text-white/40 font-mono truncate m-0 mt-0.5">
              Public {resourceType} • anyone with link can view
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
          aria-label="Close Share Drawer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Link Quick Preview & Direct Copy Bar */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-xl bg-[#0A0908] border border-white/10">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
              Share Link
            </span>
            <p className="text-xs font-mono text-white/80 truncate m-0 mt-0.5">
              {isResolving ? 'Creating link...' : resolvedUrl || 'https://www.kylrix.space/...'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={isResolving || !resolvedUrl}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              copied
                ? 'bg-[#10B981] text-black shadow-lg shadow-[#10B981]/20'
                : 'bg-white text-black hover:bg-white/90 shadow-md'
            }`}
          >
            {copied ? (
              <>
                <Check size={13} strokeWidth={3} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Action Grid */}
      <div className="px-6 py-2">
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-3 px-0.5">
          Share Destinations
        </span>

        <div className="grid grid-cols-4 gap-2.5">
          {orderedActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => action.execute(resolvedUrl, friendlyTitle)}
                disabled={isResolving && action.id !== 'copy'}
                className="flex flex-col items-center gap-2 p-2.5 rounded-xl bg-[#0A0908] hover:bg-white/[0.04] border border-white/5 hover:border-white/15 transition-all cursor-pointer group text-center"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${action.bg} ${action.border} border flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 w-full">
                  <span className="text-[11px] font-bold text-white/90 truncate block leading-tight">
                    {action.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* QR Code Modal Display */}
      {showQR && resolvedUrl && (
        <div className="px-6 pt-3">
          <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/10 flex flex-col items-center text-center gap-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold font-clash text-white">Scan with Camera</span>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="text-[10px] text-white/40 hover:text-white"
              >
                Hide
              </button>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(resolvedUrl)}`}
                alt="QR Code"
                className="w-36 h-36 rounded-lg block"
              />
            </div>
            <p className="text-[10px] font-mono text-white/40 m-0">
              Point any mobile camera to open immediately
            </p>
          </div>
        </div>
      )}

      {/* Footer Status */}
      <div className="px-6 pt-4 mt-2 flex items-center justify-center gap-2 text-[11px] text-white/40 border-t border-white/5 font-sans">
        <Globe size={13} className="text-[#10B981]" />
        <span>Anyone with this link can view this {resourceType}</span>
      </div>
    </div>
  );
}

