'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  Share2, 
  QrCode, 
  Mail, 
  MessageSquare, 
  Send, 
  X,
  ShieldCheck
} from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { executeInstantShare } from '@/lib/share/instant-share';
import { PublicResourceType } from '@/lib/share/resource-types';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { account } from '@/lib/appwrite/client';
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

  return ['copy', 'x', 'whatsapp', 'telegram', 'native'];
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

export function ShareContextDrawer() {
  const { drawerData, close, open } = useUnifiedDrawer();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isResolving, setIsResolving] = useState(true);
  const [methodOrder, setMethodOrder] = useState<string[]>(['copy', 'x', 'whatsapp', 'telegram', 'native']);
  const [showQR, setShowQR] = useState(false);

  const data: ShareContextData = drawerData || {
    resourceType: 'note',
    resourceId: '',
    resourceTitle: 'Untitled',
  };

  const { resourceType, resourceId, resourceTitle = 'Untitled', dek, projectId, isPublic = true, isGuest = true } = data;
  const friendlyTitle = resourceTitle || resourceType;

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
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const allActions: Record<string, ShareActionItem> = useMemo(() => ({
    copy: {
      id: 'copy',
      label: copied ? 'Copied!' : 'Copy Link',
      sublabel: 'Direct secure link',
      icon: copied ? Check : Copy,
      color: copied ? 'text-emerald-400' : 'text-white',
      bg: copied ? 'bg-emerald-500/15' : 'bg-white/[0.06]',
      border: copied ? 'border-emerald-500/30' : 'border-white/10',
      execute: handleCopyLink,
    },
    x: {
      id: 'x',
      label: 'Post on X',
      sublabel: 'x.com / Twitter',
      icon: (props) => (
        <svg viewBox="0 0 24 24" width={props.size || 18} height={props.size || 18} fill="currentColor" className={props.className}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      color: 'text-white',
      bg: 'bg-black/60',
      border: 'border-white/15',
      execute: (url, title) => {
        const text = encodeURIComponent(`Check out "${title}" on @Kylrix:\n\n${url}`);
        window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('x', user?.$id);
      },
    },
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp',
      sublabel: 'Chat or Status',
      icon: MessageSquare,
      color: 'text-[#25D366]',
      bg: 'bg-[#25D366]/10',
      border: 'border-[#25D366]/25',
      execute: (url, title) => {
        const text = encodeURIComponent(`${title}: ${url}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('whatsapp', user?.$id);
      },
    },
    telegram: {
      id: 'telegram',
      label: 'Telegram',
      sublabel: 'Channel or Direct',
      icon: Send,
      color: 'text-[#229ED9]',
      bg: 'bg-[#229ED9]/10',
      border: 'border-[#229ED9]/25',
      execute: (url, title) => {
        const text = encodeURIComponent(title);
        const encodedUrl = encodeURIComponent(url);
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${text}`, '_blank', 'noopener,noreferrer');
        void recordShareMethodUsage('telegram', user?.$id);
      },
    },
    qr: {
      id: 'qr',
      label: 'QR Code',
      sublabel: 'Scan & open on mobile',
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
      sublabel: 'Send via Mail client',
      icon: Mail,
      color: 'text-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      border: 'border-[#F59E0B]/25',
      execute: (url, title) => {
        const subject = encodeURIComponent(`Shared Kylrix Resource: ${title}`);
        const body = encodeURIComponent(`Here is the link to "${title}":\n\n${url}\n\nShared privately via Kylrix.`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        void recordShareMethodUsage('email', user?.$id);
      },
    },
    native: {
      id: 'native',
      label: 'More',
      sublabel: 'System Share Sheet',
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
          } catch (err: any) {
            if (err?.name !== 'AbortError') {
              toast.error('Native sharing failed, link copied instead');
              await handleCopyLink();
            }
          }
        } else {
          toast('System share not supported on this browser, link copied!');
          await handleCopyLink();
        }
      },
    },
  }), [copied, resolvedUrl, user?.$id]);

  const orderedActions = useMemo(() => {
    const defaultKeys = ['copy', 'x', 'whatsapp', 'telegram', 'qr', 'email', 'native'];
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
      {/* Top Handle / Notch */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      {/* Header */}
      <div className="px-6 pb-4 pt-1 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/80 shrink-0">
            <Share2 size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold font-clash text-white truncate m-0">
              Share {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
            </h3>
            <p className="text-[11px] text-white/40 font-mono truncate m-0 mt-0.5">
              {friendlyTitle}
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
              Public Link
            </span>
            <p className="text-xs font-mono text-white/80 truncate m-0 mt-0.5">
              {isResolving ? 'Generating secure instant link...' : resolvedUrl || 'https://kylrix.space/...'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={isResolving || !resolvedUrl}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
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

        <div className="grid grid-cols-4 gap-3">
          {orderedActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => action.execute(resolvedUrl, friendlyTitle)}
                disabled={isResolving && action.id !== 'copy'}
                className="flex flex-col items-center gap-2 p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all cursor-pointer group text-center"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${action.bg} ${action.border} border flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform shadow-md`}
                >
                  <Icon size={20} />
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

      {/* Footer Security Badging */}
      <div className="px-6 pt-4 mt-2 flex items-center justify-center gap-2 text-[10px] font-mono text-white/30 border-t border-white/5">
        <ShieldCheck size={12} className="text-emerald-400/60" />
        <span>End-to-End Synced • Unrestricted Public Access</span>
      </div>
    </div>
  );
}
