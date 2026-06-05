'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  UserCircle as ProfileIcon,
  ShieldCheck as SecurityIcon,
  MonitorSmartphone as SessionsIcon,
  History as ActivityIcon,
  Fingerprint as IdentityIcon,
  Sliders as PreferencesIcon,
  Settings2 as RootAccountIcon,
  ShieldAlert as AdminIcon,
  Plus,
  X,
} from 'lucide-react';
import { isUserAdmin } from '@/lib/actions/admin/check-admin';
import { useAuth } from '@/context/auth/AuthContext';

export function AccountsBottomChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { getJWT } = useAuth();

  useEffect(() => {
    let active = true;
    async function checkAdmin() {
      try {
        const jwt = await getJWT();
        const result = await isUserAdmin(jwt || undefined);
        console.log('[AccountsBottomChrome] isUserAdmin result:', result);
        if (active) setIsAdmin(result);
      } catch (err) {
        console.error('[AccountsBottomChrome] Failed to check admin status:', err);
      }
    }
    checkAdmin();
    return () => {
      active = false;
    };
  }, [getJWT]);

  // Map subsettings from URL
  const currentSubsetting = useMemo(() => {
    const parts = pathname?.split('/');
    return parts?.[parts.length - 1] || 'profile';
  }, [pathname]);

  const mainItems = [
    { value: 'profile', icon: ProfileIcon, label: 'Profile', path: '/accounts/settings/profile' },
    { value: 'security', icon: SecurityIcon, label: 'Security', path: '/accounts/settings/security' },
    { value: 'sessions', icon: SessionsIcon, label: 'Sessions', path: '/accounts/settings/sessions' },
    { value: 'activity', icon: ActivityIcon, label: 'Activity', path: '/accounts/settings/activity' }
  ];

  const secondaryItems = useMemo(() => {
    const items = [
      { value: 'identities', icon: IdentityIcon, label: 'Identities', path: '/accounts/settings/identities' },
      { value: 'preferences', icon: PreferencesIcon, label: 'Preferences', path: '/accounts/settings/preferences' },
      { value: 'account', icon: RootAccountIcon, label: 'Account', path: '/accounts/settings/account' }
    ];
    if (isAdmin) {
      items.push({ value: 'admin', icon: AdminIcon, label: 'Admin', path: '/accounts/admin' });
    }
    return items;
  }, [isAdmin]);

  return (
    <>
      {/* Content Blur Backdrop */}
      <div
        aria-hidden
        onClick={() => setSpeedDialOpen(false)}
        className={`fixed inset-0 z-[1299] pointer-events-none transition-all duration-300 ${
          speedDialOpen 
            ? 'opacity-100 backdrop-blur-md saturate-[170%] bg-black/40 pointer-events-auto' 
            : 'opacity-0 backdrop-blur-0 bg-transparent'
        }`}
      />

      <div className="fixed left-0 right-0 bottom-0 z-[1300] block md:hidden">
        {/* Premium FAB SpeedDial for secondary items */}
        <div className="absolute bottom-22 right-5 z-50 flex flex-col items-end gap-3">
          {/* Expanded SpeedDial Actions */}
          {speedDialOpen && (
            <div className="flex flex-col gap-3 items-end mb-2">
              {secondaryItems.map((action, idx) => {
                const isSelected = currentSubsetting === action.value;
                const Icon = action.icon;
                return (
                  <div 
                    key={action.value}
                    className="flex items-center gap-3 animate-fade-in-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Tooltip Label */}
                    <span className="bg-black/90 border border-white/10 text-white font-satoshi font-bold tracking-wider text-[10px] uppercase px-3 py-1.5 rounded-lg select-none shadow-xl backdrop-blur-md">
                      {action.label}
                    </span>
                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        router.push(action.path);
                      }}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-lg backdrop-blur-md ${
                        isSelected
                          ? 'bg-[#6366F1]/10 border-[#6366F1] text-[#6366F1]'
                          : 'bg-black/70 border-white/10 text-white/80 hover:bg-[#6366F1]/10 hover:text-[#6366F1] hover:border-[#6366F1] hover:-translate-y-0.5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trigger FAB */}
          <button
            type="button"
            onClick={() => setSpeedDialOpen(!speedDialOpen)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl transition-all duration-300 transform cursor-pointer ${
              speedDialOpen 
                ? 'bg-[#1F1D1B] text-white hover:bg-[#2B2927]' 
                : 'bg-[#6366F1] text-black hover:bg-[#5254E8] hover:-translate-y-0.5'
            }`}
          >
            {speedDialOpen ? (
              <X className="w-6 h-6 transform rotate-90 duration-300" strokeWidth={2.5} />
            ) : (
              <Plus className="w-6 h-6 transform duration-300" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Bottom Navigation Bar */}
        <div className="w-full bg-[#161412] border-t border-white/5 px-4 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-around h-16">
            {mainItems.map((item) => {
              const isSelected = currentSubsetting === item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    isSelected ? 'text-[#6366F1]' : 'text-white/40 hover:text-white'
                  }`}
                >
                  <Icon 
                    className={`w-6 h-6 transition-all duration-300 ${
                      isSelected ? 'scale-110 -translate-y-0.5 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]' : ''
                    }`} 
                  />
                  <span className="text-[9px] font-bold mt-1 font-satoshi uppercase tracking-wider">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
