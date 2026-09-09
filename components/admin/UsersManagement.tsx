"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Mail, 
  MoreVertical, 
  UserPlus, 
  Shield, 
  Activity,
  Trash2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import AdminLayout from '@/components/admin/components/AdminLayout';
import { getAdminUsersAction } from '@/lib/actions/billing/admin';
import { useAuth } from '@/context/auth/AuthContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getAdminUsersCacheKey } from '@/lib/admin/admin-cache';

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  joinDate: string;
  emailVerification: boolean;
  labels: string[];
}

export default function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, getJWT } = useAuth();

  const fetchUsers = useCallback(async (force = false) => {
    const cacheKey = getAdminUsersCacheKey(user?.$id, searchTerm);
    if (!cacheKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJWT();
      const data = await LocalEngine.query(
        cacheKey,
        async () => await getAdminUsersAction({
          search: searchTerm,
          verifiedOnly: false,
          limit: 100
        }, jwt || undefined),
        { ttl: 3 * 60 * 1000, force }
      );
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [user?.$id, searchTerm, getJWT]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black font-clash text-white tracking-tight leading-tight mb-1">
            User Directory
          </h2>
          <p className="text-sm font-bold text-white/60 font-satoshi">
            Manage ecosystem members, permissions, and status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={loading}
            className="p-3 rounded-xl bg-[#000000] border-2 border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center shadow-lg"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            type="button"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all duration-200 cursor-pointer border-2 border-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.35)]"
          >
            <UserPlus size={18} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-[22px] bg-[#000000] border-2 border-white/20 mb-6 shadow-2xl">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/50" />
          <input 
            type="text"
            placeholder="Search users by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#000000] pl-12 pr-4 py-3.5 rounded-xl border-2 border-white/20 text-white text-sm font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none transition-all duration-200 placeholder:text-white/40 font-mono"
          />
        </div>
      </div>

      {/* Users Table Container */}
      <div className="rounded-[28px] bg-[#000000] border-2 border-white/20 overflow-hidden min-h-[200px] flex flex-col shadow-2xl">
        {loading && users.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
          </div>
        ) : error ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <span className="text-rose-400 font-extrabold text-sm">{error}</span>
            <button 
              type="button"
              onClick={() => fetchUsers(true)}
              className="px-4 py-2 rounded-xl bg-[#000000] border-2 border-white/20 hover:border-white/40 text-xs font-black text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto font-satoshi">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#000000] border-b-2 border-white/20">
                  <th className="px-6 py-4 text-[10px] font-black text-white/60 uppercase tracking-wider font-mono">Member</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/60 uppercase tracking-wider font-mono">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/60 uppercase tracking-wider font-mono">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/60 uppercase tracking-wider font-mono">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/60 uppercase tracking-wider text-right font-mono">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white/10">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6366F1] text-white border-2 border-[#6366F1] flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-white truncate">{u.name}</h4>
                          <p className="text-[11px] font-mono text-white/50 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black font-mono uppercase tracking-wider border ${
                        u.status === 'active'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/10 border-white/20 text-white/60'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-white">
                        {u.role === 'admin' ? (
                          <Shield size={14} className="text-[#818CF8]" />
                        ) : (
                          <Activity size={14} className="text-white/40" />
                        )}
                        <span className="capitalize">{u.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-mono font-bold text-white/60">
                      {u.joinDate}
                    </td>
                    <td className="px-6 py-4.5 align-middle">
                      <div className="flex justify-end items-center gap-2">
                        {/* Send Email */}
                        <div className="group relative">
                          <button 
                            type="button"
                            className="p-2 rounded-xl border-2 border-white/10 hover:border-white/30 text-white/60 hover:text-white bg-[#000000] transition-all cursor-pointer"
                          >
                            <Mail size={16} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#000000] border-2 border-white/20 text-white text-[10px] px-2.5 py-1 rounded-lg whitespace-nowrap shadow-2xl z-20 font-black uppercase tracking-wider">
                            Send Email
                          </div>
                        </div>

                        {/* Suspend / Activate */}
                        <div className="group relative">
                          <button 
                            type="button"
                            className={`p-2 rounded-xl border-2 transition-all cursor-pointer bg-[#000000] ${
                              u.status === 'active'
                                ? 'border-white/10 hover:border-rose-500/40 text-white/60 hover:text-rose-400'
                                : 'border-white/10 hover:border-emerald-500/40 text-white/60 hover:text-emerald-400'
                            }`}
                          >
                            {u.status === 'active' ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#000000] border-2 border-white/20 text-white text-[10px] px-2.5 py-1 rounded-lg whitespace-nowrap shadow-2xl z-20 font-black uppercase tracking-wider">
                            {u.status === 'active' ? 'Suspend User' : 'Activate User'}
                          </div>
                        </div>

                        <button 
                          type="button"
                          className="p-2 rounded-xl border-2 border-white/10 hover:border-white/30 text-white/60 hover:text-white bg-[#000000] transition-all cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs text-white/50 font-black font-mono">
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
