"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Activity, 
  Cpu, 
  TrendingUp, 
  ChevronRight,
  Zap,
  RefreshCw
} from 'lucide-react';
import AdminLayout from './components/AdminLayout';
import { getAdminStatsAction } from '../actions/admin';
import { useAuth } from '@/context/auth/AuthContext';

export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen bg-[#0A0908]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { getJWT } = useAuth();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const jwt = await getJWT();
      const data = await getAdminStatsAction(jwt || undefined);
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      setStats({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [getJWT]);

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || '0', icon: Users, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', borderColor: 'hover:border-indigo-500/30', trend: stats?.growth || '+0%' },
    { label: 'Active Sessions', value: stats?.activeNow || '0', icon: Activity, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'hover:border-emerald-500/30', trend: '+5%' },
    { label: 'API Requests', value: '48.2k', icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'hover:border-amber-500/30', trend: '+18%' },
    { label: 'System Health', value: stats?.systemHealth || '99.9%', icon: Cpu, color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'hover:border-pink-500/30', trend: 'Stable' }
  ];

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black font-clash text-white tracking-tight leading-tight mb-1">
            System Overview
          </h2>
          <p className="text-sm text-white/40 font-satoshi">
            Real-time analytics and management across the Kylrix Ecosystem.
          </p>
        </div>
        <button 
          type="button"
          onClick={fetchStats} 
          disabled={loading}
          className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center self-start sm:self-auto"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Grid container for Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div 
            key={stat.label}
            className={`p-6 rounded-[24px] bg-[#161412] border border-white/5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 ${stat.borderColor}`}
          >
            <div className={`p-3 rounded-2xl ${stat.bgColor} ${stat.color} w-fit`}>
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">
                {stat.label}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-white font-satoshi">
                  {loading ? (
                    <div className="animate-pulse w-12 h-6 bg-white/10 rounded" />
                  ) : (
                    stat.value
                  )}
                </span>
                <span className={`text-[10px] font-black font-mono tracking-wider px-2 py-0.5 rounded ${
                  stat.trend.includes('+') ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/40'
                }`}>
                  {stat.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Chart */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-[32px] bg-[#161412] border border-white/5 flex flex-col gap-6 min-h-[400px]">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
              Ecosystem Activity
            </h3>
            <button 
              type="button"
              className="flex items-center gap-1 text-sm font-bold text-[#6366F1] hover:text-[#5254E8] transition-colors cursor-pointer"
            >
              <span>Full Analytics</span>
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="h-[280px] w-full flex items-end justify-between p-4 border border-dashed border-white/5 rounded-2xl bg-[#6366F1]/[0.01] gap-2">
            {stats?.analytics ? stats.analytics.map((day: any, i: number) => {
              const max = Math.max(...stats.analytics.map((d: any) => d.users));
              const height = (day.users / max) * 100;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                  <div className="group relative w-full flex items-end justify-center h-[90%]">
                    <div 
                      className={`w-full max-w-[24px] rounded-lg transition-all duration-300 hover:bg-[#6366F1] ${
                        i === 6 ? 'bg-[#6366F1]' : 'bg-[#6366F1]/20'
                      }`}
                      style={{ height: `${Math.max(10, height)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1E1C1A] border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-xl z-20 font-semibold">
                      {day.users} active
                    </div>
                  </div>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    {day.name}
                  </span>
                </div>
              );
            }) : (
              <div className="text-center w-full py-16 flex flex-col items-center gap-3">
                <TrendingUp size={48} className="text-[#6366F1]/20" strokeWidth={1.5} />
                <span className="text-sm text-white/20 font-bold font-satoshi">
                  Loading Chart Data...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Signups */}
        <div className="p-6 md:p-8 rounded-[32px] bg-[#161412] border border-white/5 flex flex-col gap-6 justify-between">
          <div>
            <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight mb-4">
              Recent Signups
            </h3>
            
            <div className="flex flex-col gap-5">
              {stats?.recentUsers?.length ? stats.recentUsers.slice(0, 4).map((u: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-black text-sm flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">
                      {u.name}
                    </h4>
                    <p className="text-xs text-white/40 truncate">
                      {u.email}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-white/60 block font-medium">
                      {new Date(u.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[9px] text-[#10B981] font-extrabold uppercase tracking-wider block mt-0.5">NEW</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-white/45 text-center py-6">
                  No recent users to show yet.
                </p>
              )}
            </div>
          </div>

          <Link href="/accounts/admin/users" passHref legacyBehavior>
            <a className="w-full text-center py-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-white hover:bg-white/[0.06] hover:border-white/10 transition-all font-bold text-xs cursor-pointer block mt-6">
              Manage All Users
            </a>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
