'use client';

import { useState, useEffect } from 'react';
import { AppwriteService } from '@/lib/appwrite';
import { account } from '@/lib/appwrite/client';
import { useTheme } from '@/lib/theme-context';
import Link from 'next/link';

interface PrefsData {
  language?: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
  emailNotifications?: boolean;
  sessionReminders?: boolean;
  dataCollection?: boolean;
  marketingEmails?: boolean;
  publicProfile?: boolean;
  smartSystemHistory?: boolean;
}

interface PreferencesManagerProps {
  onSave?: () => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' }
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'US/Eastern', label: 'Eastern Time' },
  { value: 'US/Central', label: 'Central Time' },
  { value: 'US/Mountain', label: 'Mountain Time' },
  { value: 'US/Pacific', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney' }
];

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-[#6366F1]' : 'bg-white/10'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function PreferencesManager({ onSave }: PreferencesManagerProps) {
  const { setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allPrefs, setAllPrefs] = useState<Record<string, any>>({});
  const [prefs, setPrefs] = useState<PrefsData>({
    language: 'en',
    timezone: 'UTC',
    theme: 'system',
    emailNotifications: true,
    sessionReminders: true,
    dataCollection: false,
    marketingEmails: false,
    publicProfile: true,
    smartSystemHistory: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const appPrefs = await account.getPrefs();
      setAllPrefs(appPrefs || {});
      setPrefs({
        language: appPrefs?.language || 'en',
        timezone: appPrefs?.timezone || 'UTC',
        theme: appPrefs?.theme || 'system',
        emailNotifications: appPrefs?.emailNotifications !== false,
        sessionReminders: appPrefs?.sessionReminders !== false,
        dataCollection: appPrefs?.dataCollection === true,
        marketingEmails: appPrefs?.marketingEmails === true,
        publicProfile: appPrefs?.publicProfile !== false,
        smartSystemHistory: appPrefs?.smartSystemHistory !== false,
      });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof PrefsData, value: any) => {
    try {
      setError(null);
      const updatedUIPrefs = { ...prefs, [key]: value };
      setPrefs(updatedUIPrefs);
      
      // Merge with ALL existing prefs
      const updatedAllPrefs = { ...allPrefs, [key]: value };
      setAllPrefs(updatedAllPrefs);
      
      if (key === 'theme') {
        await setTheme(value);
      } else {
        await account.updatePrefs(updatedAllPrefs);
      }

      // Sync to global directory if discoverability changed
      if (key === 'publicProfile' || key === 'language') {
        const user = await account.get();
        await AppwriteService.syncGlobalProfile(user, updatedAllPrefs);
      }

      onSave?.();
    } catch (_err: unknown) {
      const err = _err as Error;
      setError(err.message);
      // Reload from server on error
      loadPreferences();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white font-satoshi">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold">
          <span className="block font-bold mb-1">Error</span>
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Localization & Display Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
            Display & Localization
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider block">
                Theme
              </span>
              <select
                value={prefs.theme || 'system'}
                onChange={(e) => updatePreference('theme', e.target.value)}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none cursor-pointer transition-all duration-200"
              >
                <option value="system" className="bg-[#161412]">System Default</option>
                <option value="light" className="bg-[#161412]">Light Mode</option>
                <option value="dark" className="bg-[#161412]">Dark Mode</option>
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider block">
                Language
              </span>
              <select
                value={prefs.language || 'en'}
                onChange={(e) => updatePreference('language', e.target.value)}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none cursor-pointer transition-all duration-200"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-[#161412]">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider block">
                Timezone
              </span>
              <select
                value={prefs.timezone || 'UTC'}
                onChange={(e) => updatePreference('timezone', e.target.value)}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none cursor-pointer transition-all duration-200"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-[#161412]">
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Discoverability Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
            Discoverability
          </h3>
          <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-white">
                Public Profile
              </h4>
              <p className="text-xs text-[#9B9691]">
                Allow other users to find you by name or username
              </p>
            </div>
            <Switch
              checked={prefs.publicProfile !== false}
              onChange={(checked) => updatePreference('publicProfile', checked)}
            />
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Notification Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
            Notifications
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Email Notifications
                </h4>
                <p className="text-xs text-[#9B9691]">
                  Receive emails about account activity
                </p>
              </div>
              <Switch
                checked={prefs.emailNotifications !== false}
                onChange={(checked) => updatePreference('emailNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Session Reminders
                </h4>
                <p className="text-xs text-[#9B9691]">
                  Get reminded about active sessions
                </p>
              </div>
              <Switch
                checked={prefs.sessionReminders !== false}
                onChange={(checked) => updatePreference('sessionReminders', checked)}
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Privacy Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
            Privacy & Data
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Data Collection
                </h4>
                <p className="text-xs text-[#9B9691]">
                  Allow collection of usage analytics
                </p>
              </div>
              <Switch
                checked={prefs.dataCollection === true}
                onChange={(checked) => updatePreference('dataCollection', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Smart System Chat History
                </h4>
                <p className="text-xs text-[#9B9691]">
                  Keep a local-first interactive history of Smart System chats & requests
                </p>
              </div>
              <Switch
                checked={prefs.smartSystemHistory !== false}
                onChange={(checked) => updatePreference('smartSystemHistory', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Agent Permissions & Settings
                </h4>
                <p className="text-xs text-[#9B9691]">
                  View and manage authorization rules and sweeps for agentic actions
                </p>
              </div>
              <Link 
                href="/settings/agents"
                className="px-3 py-1.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5"
              >
                Configure
              </Link>
            </div>

            <div className="flex items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-[#1F1D1B] hover:border-white/10 transition-all">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Marketing Emails
                </h4>
                <p className="text-xs text-[#9B9691]">
                  Receive promotional and marketing emails
                </p>
              </div>
              <Switch
                checked={prefs.marketingEmails === true}
                onChange={(checked) => updatePreference('marketingEmails', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
