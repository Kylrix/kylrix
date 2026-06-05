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
import AdminLayout from '../components/AdminLayout';
import { getAdminUsersAction } from '../../actions/admin';
import { useAuth } from '@/context/auth/AuthContext';

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
  const { getJWT } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJWT();
      const data = await getAdminUsersAction({
        search: searchTerm,
        verifiedOnly: false,
        limit: 100,
      }, jwt || undefined);
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, getJWT]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black font-clash text-white tracking-tight leading-tight mb-1">
            User Directory
          </h2>
          <p className="text-sm text-white/40 font-satoshi">
            Manage ecosystem members, permissions, and status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => fetchUsers()} 
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            type="button"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(99,102,241,0.2)]"
          >
            <UserPlus size={18} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-[20px] bg-[#161412] border border-white/5 mb-6">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
          <input 
            type="text"
            placeholder="Search users by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.02] pl-12 pr-4 py-3.5 rounded-xl border border-white/5 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all duration-200 placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Users Table Container */}
      <div className="rounded-[28px] bg-[#161412] border border-white/5 overflow-hidden min-h-[200px] flex flex-col">
        {loading && users.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
          </div>
        ) : error ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <span className="text-red-400 font-bold text-sm">{error}</span>
            <button 
              type="button"
              onClick={() => fetchUsers()} 
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-extrabold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto font-satoshi">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-black text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                          <p className="text-xs text-white/40 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        user.status === 'active' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                        {user.role === 'admin' ? (
                          <Shield size={14} className="text-[#6366F1]" />
                        ) : (
                          <Activity size={14} className="text-white/20" />
                        )}
                        <span className="capitalize">{user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-sm text-white/60">
                      {user.joinDate}
                    </td>
                    <td className="px-6 py-4.5 align-middle">
                      <div className="flex justify-end items-center gap-2">
                        {/* Send Email */}
                        <div className="group relative">
                          <button 
                            type="button"
                            className="p-1.5 rounded-lg text-white/40 hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-all cursor-pointer"
                          >
                            <Mail size={16} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#1E1C1A] border border-white/10 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-xl z-20 font-bold uppercase tracking-wider">
                            Send Email
                          </div>
                        </div>

                        {/* Suspend / Activate */}
                        <div className="group relative">
                          <button 
                            type="button"
                            className={`p-1.5 rounded-lg text-white/40 hover:bg-white/5 transition-all cursor-pointer ${
                              user.status === 'active' ? 'hover:text-red-400 hover:bg-red-500/10' : 'hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {user.status === 'active' ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#1E1C1A] border border-white/10 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-xl z-20 font-bold uppercase tracking-wider">
                            {user.status === 'active' ? 'Suspend User' : 'Activate User'}
                          </div>
                        </div>

                        <button 
                          type="button"
                          className="p-1.5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-white/40 font-bold">
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
