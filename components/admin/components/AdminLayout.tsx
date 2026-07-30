"use client";

import React, { Suspense } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Mail,
  ShieldCheck,
  ChevronRight,
  Ticket
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import AdminGuard from './AdminGuard';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/settings?section=admin' },
  { label: 'Users', icon: Users, href: '/settings?section=admin-users' },
  { label: 'Email Center', icon: Mail, href: '/settings?section=admin-emails' },
  { label: 'Coupons', icon: Ticket, href: '/settings?section=admin-coupons' }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen bg-[#0A0908]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    }>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname?.startsWith('/settings')) {
    return (
      <AdminGuard>
        <div className="w-full text-white font-satoshi">
          {children}
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#0A0908] text-white font-satoshi">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-[280px] bg-[#161412] border-r border-white/5 p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-8">
            <Logo app="accounts" variant="icon" size={32} />
            <div>
              <h1 className="font-clash font-black text-lg text-white leading-none">
                ADMIN
              </h1>
              <span className="text-[10px] font-extrabold text-[#6366F1] tracking-wider uppercase block mt-1">
                Ecosystem Core
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#6366F1]/10 text-white border border-[#6366F1]/20'
                      : 'text-white/50 hover:bg-white/[0.02] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#6366F1]' : 'text-white/40'}`} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/5">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#6366F1]/[0.03] border border-white/[0.03]">
              <div className="p-2 rounded-xl bg-[#6366F1]/10 text-[#6366F1]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">
                  Secure Access
                </h4>
                <p className="text-[10px] text-white/40">
                  Admin Privileges Active
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-grow p-4 md:p-12 pb-24 md:pb-12 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[72px] bg-[#161412] border-t border-white/5 flex items-center justify-around px-4 shadow-[0_-12px_36px_rgba(0,0,0,0.34)]">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center p-2 transition-all duration-200 ${
                isActive ? 'text-[#6366F1]' : 'text-white/45'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] mt-1 font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </AdminGuard>
  );
}
