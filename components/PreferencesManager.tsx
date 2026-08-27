'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Terminal, 
  Volume2, 
  Mail, 
  Moon, 
  Sun, 
  Laptop
} from 'lucide-react';
import { account } from '@/lib/appwrite/client';
import { useTheme } from '@/lib/theme-context';
import { useDevMode } from '@/lib/dev-mode';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { toast } from 'react-hot-toast';

interface KylrixPrefs {
  theme?: 'light' | 'dark' | 'system';
  demo_mode?: boolean;
  compact_density?: boolean;
  smartSystemHistory?: boolean;
  sound_effects?: boolean;
  haptic_feedback?: boolean;
  emailNotifications?: boolean;
  sessionReminders?: boolean;
  marketingEmails?: boolean;
}

function ModernSwitch({ 
  checked, 
  onChange, 
  disabled = false 
}: { 
  checked: boolean; 
  onChange: (val: boolean) => void; 
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
        checked ? 'bg-[#6366F1]' : 'bg-white/10'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function PreferencesManager({ onSave }: { onSave?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { devMode, toggleDevMode } = useDevMode();
  const [loading, setLoading] = useState(true);
  const [allPrefs, setAllPrefs] = useState<Record<string, any>>({});
  const [prefs, setPrefs] = useState<KylrixPrefs>({
    theme: 'system',
    demo_mode: false,
    compact_density: false,
    smartSystemHistory: true,
    sound_effects: true,
    haptic_feedback: true,
    emailNotifications: true,
    sessionReminders: true,
    marketingEmails: false,
  });

  const loadPreferences = useCallback(async () => {
    // 1. Check local cache first for instant paint
    const cached = await LocalEngine.cacheGet<Record<string, any>>('kylrix_user_prefs_cache');
    if (cached) {
      setAllPrefs(cached);
      setPrefs({
        theme: (cached.theme as any) || 'system',
        demo_mode: Boolean(cached.demo_mode),
        compact_density: Boolean(cached.compact_density),
        smartSystemHistory: cached.smartSystemHistory !== false,
        sound_effects: cached.sound_effects !== false,
        haptic_feedback: cached.haptic_feedback !== false,
        emailNotifications: cached.emailNotifications !== false,
        sessionReminders: cached.sessionReminders !== false,
        marketingEmails: Boolean(cached.marketingEmails),
      });
      setLoading(false);
    }

    // 2. Fetch fresh preferences from Appwrite
    try {
      const appPrefs = await account.getPrefs();
      if (appPrefs) {
        setAllPrefs(appPrefs);
        setPrefs({
          theme: (appPrefs.theme as any) || 'system',
          demo_mode: Boolean(appPrefs.demo_mode),
          compact_density: Boolean(appPrefs.compact_density),
          smartSystemHistory: appPrefs.smartSystemHistory !== false,
          sound_effects: appPrefs.sound_effects !== false,
          haptic_feedback: appPrefs.haptic_feedback !== false,
          emailNotifications: appPrefs.emailNotifications !== false,
          sessionReminders: appPrefs.sessionReminders !== false,
          marketingEmails: Boolean(appPrefs.marketingEmails),
        });
        void LocalEngine.cacheSet('kylrix_user_prefs_cache', appPrefs);
      }
    } catch (err) {
      console.warn('Failed to load user preferences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const updatePreference = async (key: keyof KylrixPrefs, value: any) => {
    const updatedUIPrefs = { ...prefs, [key]: value };
    setPrefs(updatedUIPrefs);

    const updatedAllPrefs = { ...allPrefs, [key]: value };
    setAllPrefs(updatedAllPrefs);
    void LocalEngine.cacheSet('kylrix_user_prefs_cache', updatedAllPrefs);

    try {
      if (key === 'theme') {
        await setTheme(value);
      } else {
        await account.updatePrefs(updatedAllPrefs);
      }
      toast.success('Preference updated');
      onSave?.();
    } catch (_err) {
      toast.error('Failed to save preference');
      void loadPreferences();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white select-none">
      {/* SECTION 1: Workspace & Environment */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-[#6366F1]" />
          <h3 className="text-xs font-black uppercase tracking-wider font-mono text-white/50 m-0">
            Workspace & Environment
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Developer Mode */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white m-0">Developer Mode & Tools</h4>
                {devMode && (
                  <span className="px-2 py-0.5 rounded-md bg-[#6366F1]/20 border border-[#6366F1]/30 text-[#818cf8] text-[9px] font-mono font-bold uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Enable action log traces, internal flow execution engines, and debug controls across the suite.
              </p>
            </div>
            <ModernSwitch
              checked={devMode}
              onChange={(checked) => void toggleDevMode(checked)}
            />
          </div>

          {/* Demo Mode */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white m-0">Demo / Presentation Mode</h4>
                {prefs.demo_mode && (
                  <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] text-[9px] font-mono font-bold uppercase">
                    Sandbox
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Populate playground environments with interactive mock nodes, workflows, and test data.
              </p>
            </div>
            <ModernSwitch
              checked={Boolean(prefs.demo_mode)}
              onChange={(checked) => updatePreference('demo_mode', checked)}
            />
          </div>

          {/* Smart System History */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Smart Assistant Interaction Memory</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Keep a client-side local IndexedDB journal of interactions and prompt sequences with assistants.
              </p>
            </div>
            <ModernSwitch
              checked={prefs.smartSystemHistory !== false}
              onChange={(checked) => updatePreference('smartSystemHistory', checked)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Appearance & Visual Theme */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Moon size={15} className="text-[#6366F1]" />
          <h3 className="text-xs font-black uppercase tracking-wider font-mono text-white/50 m-0">
            Appearance & Surfaces
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Theme Palette */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white m-0">Color Scheme & Contrast</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Select your preferred interface luminance. High-contrast pitch surfaces are default across OpenBricks.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Laptop },
                { id: 'light', label: 'Light', icon: Sun },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = (prefs.theme || theme) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updatePreference('theme', item.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#161412] border-[#6366F1] text-white shadow-lg'
                        : 'bg-[#161412]/50 border-white/[0.06] text-white/50 hover:text-white hover:bg-[#161412]'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-[#6366F1]' : 'text-white/40'} />
                    <span className="text-xs font-bold font-mono">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Density */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Compact Information Density</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Reduce vertical padding in note lists, credential rows, and sidebars for higher information throughput.
              </p>
            </div>
            <ModernSwitch
              checked={Boolean(prefs.compact_density)}
              onChange={(checked) => updatePreference('compact_density', checked)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Tactile & Audio Feedback */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Volume2 size={15} className="text-[#6366F1]" />
          <h3 className="text-xs font-black uppercase tracking-wider font-mono text-white/50 m-0">
            Tactile & Feedback
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Sound FX */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Tactile Audio Feedback</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Play subtle audio clicks and chimes on note creation, unlock authentication, and completed sweeps.
              </p>
            </div>
            <ModernSwitch
              checked={prefs.sound_effects !== false}
              onChange={(checked) => updatePreference('sound_effects', checked)}
            />
          </div>

          {/* Haptic Feedback */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Mobile Haptic Vibration</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Trigger lightweight device vibrations during drawer gestures and primary button actions.
              </p>
            </div>
            <ModernSwitch
              checked={prefs.haptic_feedback !== false}
              onChange={(checked) => updatePreference('haptic_feedback', checked)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: Email Dispatch & Alerts */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-[#6366F1]" />
          <h3 className="text-xs font-black uppercase tracking-wider font-mono text-white/50 m-0">
            Email Dispatch & Notifications
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Activity Notifications */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Account Activity Relay</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Receive transactional email digests when workspace collaborations or shared objects change.
              </p>
            </div>
            <ModernSwitch
              checked={prefs.emailNotifications !== false}
              onChange={(checked) => updatePreference('emailNotifications', checked)}
            />
          </div>

          {/* Session Reminders */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">New Session & Security Alerts</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Notify your primary email address whenever a new device or browser session logs in.
              </p>
            </div>
            <ModernSwitch
              checked={prefs.sessionReminders !== false}
              onChange={(checked) => updatePreference('sessionReminders', checked)}
            />
          </div>

          {/* Marketing Updates */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white m-0">Product Releases & Announcements</h4>
              <p className="text-xs text-white/40 font-medium leading-relaxed m-0 mt-0.5">
                Occasional announcements about new OpenBricks tools, platform releases, and upgrades.
              </p>
            </div>
            <ModernSwitch
              checked={Boolean(prefs.marketingEmails)}
              onChange={(checked) => updatePreference('marketingEmails', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
