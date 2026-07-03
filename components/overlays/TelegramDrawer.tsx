'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  alpha,
} from '@/lib/openbricks/primitives';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { Telegram as TelegramIcon } from '@/lib/openbricks/icons';
import {
  initializeTelegramConnection,
  checkTelegramConnection,
  getTelegramNotificationPreferences,
  updateTelegramNotificationPreferences,
} from '@/lib/actions/telegram';
import {
  defaultTelegramNotificationPreferences,
  TELEGRAM_ACTION_LABELS,
  TELEGRAM_OBJECT_LABELS,
  type TelegramNotificationAction,
  type TelegramNotificationObject,
  type TelegramNotificationPreferences,
} from '@/lib/telegram/notification-preferences';

interface TelegramDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (tgUsername: string) => void;
}

interface CachedConnection {
  pairCode: string;
  deepLink: string;
  createdAt: string;
  userId: string;
}

let connectionCache: CachedConnection | null = null;

export function TelegramDrawer({ open, onClose, onSuccess }: TelegramDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<TelegramNotificationPreferences>(
    defaultTelegramNotificationPreferences()
  );
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [watchedIdsInput, setWatchedIdsInput] = useState('');

  // Live timer states
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('03:00');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const jwtRef = useRef<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  const getOrUpdateJWT = React.useCallback(async () => {
    if (jwtRef.current) return jwtRef.current;
    try {
      const { account } = await import('@/lib/appwrite/client');
      const { jwt } = await account.createJWT();
      jwtRef.current = jwt;
      return jwt;
    } catch (err) {
      console.error('Failed to create JWT:', err);
      return undefined;
    }
  }, []);

  const stopPolling = React.useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = React.useCallback(() => {
    stopPolling();
    // Low-frequency polling fallback (every 10 seconds) to protect database load
    pollingRef.current = setInterval(async () => {
      const jwt = await getOrUpdateJWT();
      const res = await checkTelegramConnection(jwt);
      if (res.success && res.isVerified) {
        stopPolling();
        setVerifiedUsername(res.tgUsername || 'User');
        setIsVerifying(false);
        setTimeout(() => {
          onSuccessRef.current(res.tgUsername || 'User');
          onCloseRef.current();
        }, 2000);
      }
    }, 10000);
  }, [getOrUpdateJWT, stopPolling]);

  const handleInitialize = React.useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setPairCode(null);
    setDeepLink(null);
    setVerifiedUsername(null);
    setCreatedAt(null);
    setUserId(null);
    setTimeLeft('03:00');

    // Check client-side session-cache first if not forced
    if (!force && connectionCache) {
      const createdTime = new Date(connectionCache.createdAt).getTime();
      const now = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      if (now - createdTime < threeMinutesInMs) {
        setPairCode(connectionCache.pairCode);
        setDeepLink(connectionCache.deepLink);
        setCreatedAt(connectionCache.createdAt);
        setUserId(connectionCache.userId);
        setLoading(false);
        startPolling();
        return;
      } else {
        connectionCache = null;
      }
    }

    try {
      const jwt = await getOrUpdateJWT();
      const res = await initializeTelegramConnection(jwt, force);
      if (res.success && (res as any).isVerified) {
          setVerifiedUsername((res as any).tgUsername || 'User');
          setLoading(false);
          return;
      }
      
      if (res.success && res.pairCode && res.deepLink && res.userId) {
        setPairCode(res.pairCode);
        setDeepLink(res.deepLink);
        const codeCreatedAt = res.createdAt || new Date().toISOString();
        setCreatedAt(codeCreatedAt);
        setUserId(res.userId);

        // Cache pairing info locally on client
        connectionCache = {
          pairCode: res.pairCode,
          deepLink: res.deepLink,
          createdAt: codeCreatedAt,
          userId: res.userId,
        };

        startPolling();
      } else {
        setError(res.error || 'Failed to start verification.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [getOrUpdateJWT, startPolling]);

  const handleInitializeRef = useRef(handleInitialize);
  useEffect(() => {
    handleInitializeRef.current = handleInitialize;
  }, [handleInitialize]);

  // Real-time Event Subscription (Zero-Database-Read Verification)
  useEffect(() => {
    if (!open || !pairCode || verifiedUsername || !userId) return;

    let isSubscribed = true;
    let unsubscribeFn: (() => void) | null = null;

    const setupRealtime = async () => {
      try {
        const { realtime } = await import('@/lib/appwrite/client');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        
        if (!isSubscribed) return;

        const channel = `databases.${APPWRITE_CONFIG.DATABASES.CONNECT}.collections.${APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS}.documents.${userId}`;
        
        const sub = await realtime.subscribe(channel, (response: any) => {
          const payload = response.payload;
          if (payload && payload.is_verified) {
            stopPolling();
            setVerifiedUsername(payload.tg_username || 'User');
            setIsVerifying(false);
            setTimeout(() => {
              onSuccessRef.current(payload.tg_username || 'User');
              onCloseRef.current();
            }, 2000);
          }
        });

        unsubscribeFn = () => {
          if (typeof sub === 'function') {
            (sub as any)();
          } else if (sub && typeof (sub as any).unsubscribe === 'function') {
            (sub as any).unsubscribe();
          }
        };
      } catch (err) {
        console.error('Failed to subscribe to realtime connection status:', err);
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, [open, pairCode, verifiedUsername, userId, stopPolling]);

  // Live Expiration Timer Countdown
  useEffect(() => {
    if (!createdAt || !pairCode || verifiedUsername) {
      setTimeLeft('03:00');
      return;
    }

    const updateTimer = () => {
      const createdTime = new Date(createdAt).getTime();
      const now = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      const totalTimeLeft = Math.max(0, threeMinutesInMs - (now - createdTime));
      
      if (totalTimeLeft <= 0) {
        clearInterval(timer);
        setTimeLeft('Expired');
        handleInitializeRef.current(true);
      } else {
        const minutes = Math.floor(totalTimeLeft / 1000 / 60);
        const seconds = Math.floor((totalTimeLeft / 1000) % 60);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };

    updateTimer(); // Initial call
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [createdAt, pairCode, verifiedUsername]);

  // Initialize pairing code on mount
  useEffect(() => {
    if (open) {
      const checkAndInit = async () => {
        setLoading(true);
        setError(null);
        setPairCode(null);
        setDeepLink(null);
        setVerifiedUsername(null);
        
        try {
          const jwt = await getOrUpdateJWT();
          const res = await checkTelegramConnection(jwt);
          if (res.success && res.isVerified) {
            setVerifiedUsername(res.tgUsername || 'User');
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Failed to check Telegram connection on mount:', err);
        }
        
        // If not verified, proceed to initialize the pairing flow
        handleInitializeRef.current();
      };
      
      checkAndInit();
    }
    return () => {
      stopPolling();
    };
  }, [open, stopPolling, getOrUpdateJWT]);

  const handleManualCheck = async () => {
    setIsVerifying(true);
    setError(null);
    const jwt = await getOrUpdateJWT();
    const res = await checkTelegramConnection(jwt);
    setIsVerifying(false);
    if (res.success && res.isVerified) {
      setVerifiedUsername(res.tgUsername || 'User');
      setTimeout(() => {
        onSuccess(res.tgUsername || 'User');
        onClose();
      }, 2000);
    } else {
      setError('Connection not verified yet. Make sure you opened the link and pressed "Start" in Telegram.');
    }
  };

  const handleCopyCode = () => {
    if (pairCode) {
      navigator.clipboard.writeText(pairCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const loadPreferences = React.useCallback(async () => {
    setPrefsLoading(true);
    try {
      const jwt = await getOrUpdateJWT();
      const res = await getTelegramNotificationPreferences(jwt);
      if (res.success && res.preferences) {
        setPreferences(res.preferences);
        setWatchedIdsInput(res.preferences.watchedResourceIds.join(', '));
      }
    } catch (err) {
      console.error('Failed to load Telegram preferences:', err);
    } finally {
      setPrefsLoading(false);
    }
  }, [getOrUpdateJWT]);

  const persistPreferences = React.useCallback(async (next: TelegramNotificationPreferences) => {
    setPrefsSaving(true);
    setPrefsSaved(false);
    try {
      const jwt = await getOrUpdateJWT();
      const res = await updateTelegramNotificationPreferences(jwt, next);
      if (res.success && res.preferences) {
        setPreferences(res.preferences);
        setPrefsSaved(true);
        setTimeout(() => setPrefsSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save Telegram preferences:', err);
    } finally {
      setPrefsSaving(false);
    }
  }, [getOrUpdateJWT]);

  const updatePreference = React.useCallback((
    patch: Partial<TelegramNotificationPreferences>
  ) => {
    setPreferences((current) => {
      const next = {
        ...current,
        ...patch,
        actions: { ...current.actions, ...(patch.actions || {}) },
        objects: { ...current.objects, ...(patch.objects || {}) },
      };
      void persistPreferences(next);
      return next;
    });
  }, [persistPreferences]);

  const toggleAction = (action: TelegramNotificationAction) => {
    setPreferences((current) => {
      const next = {
        ...current,
        actions: { ...current.actions, [action]: !current.actions[action] },
      };
      void persistPreferences(next);
      return next;
    });
  };

  const toggleObject = (object: TelegramNotificationObject) => {
    setPreferences((current) => {
      const next = {
        ...current,
        objects: { ...current.objects, [object]: !current.objects[object] },
      };
      void persistPreferences(next);
      return next;
    });
  };

  const handleWatchedIdsBlur = () => {
    const watchedResourceIds = watchedIdsInput
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    setPreferences((current) => {
      const next = { ...current, watchedResourceIds };
      void persistPreferences(next);
      return next;
    });
  };

  useEffect(() => {
    if (open) {
      void loadPreferences();
    }
  }, [open, loadPreferences]);

  const renderPreferences = () => (
    <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-white text-sm font-black tracking-tight font-clash">
            Notification rules
          </h3>
          <p className="text-white/45 text-[11px] font-semibold font-satoshi mt-0.5">
            Choose which alerts reach Telegram and for which items.
          </p>
        </div>
        {prefsSaving ? (
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Saving...</span>
        ) : prefsSaved ? (
          <span className="text-[#10B981] text-[10px] font-bold uppercase tracking-wider">Saved</span>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0A09] border border-white/5">
        <span className="text-white text-xs font-bold font-satoshi">Telegram alerts enabled</span>
        <input
          type="checkbox"
          checked={preferences.enabled}
          onChange={() => updatePreference({ enabled: !preferences.enabled })}
          className="w-4 h-4 accent-[#F59E0B] cursor-pointer"
        />
      </label>

      <div className="space-y-2">
        <p className="text-white/50 text-[10px] font-black uppercase tracking-wider font-mono">Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(TELEGRAM_ACTION_LABELS) as TelegramNotificationAction[]).map((action) => (
            <label
              key={action}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <span className="text-white/80 text-[11px] font-semibold font-satoshi">
                {TELEGRAM_ACTION_LABELS[action]}
              </span>
              <input
                type="checkbox"
                checked={preferences.actions[action]}
                disabled={!preferences.enabled || prefsLoading}
                onChange={() => toggleAction(action)}
                className="w-3.5 h-3.5 accent-[#F59E0B] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-white/50 text-[10px] font-black uppercase tracking-wider font-mono">Object types</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(TELEGRAM_OBJECT_LABELS) as TelegramNotificationObject[]).map((object) => (
            <label
              key={object}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <span className="text-white/80 text-[11px] font-semibold font-satoshi">
                {TELEGRAM_OBJECT_LABELS[object]}
              </span>
              <input
                type="checkbox"
                checked={preferences.objects[object]}
                disabled={!preferences.enabled || prefsLoading}
                onChange={() => toggleObject(object)}
                className="w-3.5 h-3.5 accent-[#F59E0B] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-white/50 text-[10px] font-black uppercase tracking-wider font-mono">
          Specific items only (optional)
        </p>
        <textarea
          value={watchedIdsInput}
          onChange={(e) => setWatchedIdsInput(e.target.value)}
          onBlur={handleWatchedIdsBlur}
          disabled={!preferences.enabled || prefsLoading}
          placeholder="Paste item IDs separated by commas or new lines. Leave blank to allow all items from the types above."
          className="w-full min-h-[72px] rounded-xl bg-[#0B0A09] border border-white/5 px-3 py-2.5 text-white/80 text-xs font-mono outline-none focus:border-[#F59E0B]/40 resize-y"
        />
        <p className="text-white/35 text-[10px] font-semibold font-satoshi leading-relaxed">
          Example: only notify me for one project, one idea, or one task by pasting its ID here.
        </p>
      </div>
    </div>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          height: 'auto',
          maxHeight: '85vh',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          bgcolor: '#161514',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'white',
          boxShadow: '0 -12px 36px rgba(0, 0, 0, 0.5)',
          width: { xs: '100%', md: 540 },
          mx: 'auto',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)',
        },
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
            <TelegramIcon sx={{ fontSize: 16 }} />
          </div>
          <h2 className="text-white text-lg font-black tracking-tight font-clash">
            Telegram Notifications
          </h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 rounded-lg bg-white/2 hover:bg-white/5 text-white/50 hover:text-white transition-all border border-white/5 flex items-center justify-center cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Main Content */}
      <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-70px)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CircularProgress sx={{ color: '#F59E0B' }} size={28} />
            <span className="text-white/60 text-xs font-semibold font-satoshi">
              Connecting...
            </span>
          </div>
        ) : verifiedUsername ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-[#10B981]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white text-lg font-black tracking-tight font-clash">
                  Connected
                </h3>
                <p className="text-white/60 text-xs font-semibold font-satoshi max-w-sm mx-auto">
                  Linked to Telegram as <span className="text-[#F59E0B] font-bold">@{verifiedUsername}</span>.
                </p>
              </div>
            </div>
            {renderPreferences()}
          </div>
        ) : (
          // Pairing State
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-xs font-semibold font-satoshi leading-relaxed">
              Enable instant notifications for incoming calls, invites, and mentions.
            </p>

            {error && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <span className="text-red-400 text-xs font-semibold font-satoshi">
                  {error}
                </span>
              </div>
            )}

            {pairCode && deepLink && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-[#0B0A09] border border-white/5 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-bold font-satoshi">1. Open Assistant</span>
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs transition-all flex items-center gap-1 shadow-md cursor-pointer font-satoshi"
                    >
                      <span>Start Bot</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="h-px bg-white/5" />

                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-bold font-satoshi">2. Verify Code</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold tracking-wider text-[#F59E0B]">
                        {pairCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="text-white/45 hover:text-white p-1 hover:bg-white/5 rounded transition-all cursor-pointer font-satoshi"
                      >
                        {copied ? <span className="text-[#10B981] font-bold text-xs">Copied</span> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-white/5" />

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/45">Code Expires in:</span>
                    <span className={`font-mono font-bold ${
                      timeLeft === 'Expired' ? 'text-red-400' : 'text-white/60'
                    }`}>
                      {timeLeft}
                    </span>
                  </div>
                </div>

                {/* Handshake/Waiting Indicator */}
                <div className="flex items-center justify-center gap-2 py-0.5">
                  <CircularProgress size={10} sx={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-white/40 text-[11px] font-semibold font-satoshi">
                    Awaiting connection sync...
                  </span>
                </div>

                {/* Buttons block */}
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={handleManualCheck}
                    disabled={isVerifying}
                    className="flex-1 py-2.5 px-4 rounded-lg border border-white/8 text-white hover:bg-white/2 hover:border-white/20 transition-all font-extrabold text-xs font-satoshi disabled:opacity-50 cursor-pointer"
                  >
                    {isVerifying ? 'Checking...' : 'Check Status'}
                  </button>
                  <button
                    onClick={() => handleInitialize(true)}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all font-extrabold text-xs font-satoshi cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
            {renderPreferences()}
          </div>
        )}
      </div>
    </Drawer>
  );
}
