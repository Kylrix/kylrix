"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  Layout, 
  Users,
  CheckCircle2,
  Eye} from 'lucide-react';
import AdminLayout from '@/components/admin/components/AdminLayout';
import { EMAIL_TEMPLATES, type EmailTemplateId } from '@/lib/email-template-catalog';
import { getAdminUsersAction } from '@/lib/actions/billing/admin';
import { sendAdminEmailsAction } from '@/lib/actions/billing/emails';
import { useAuth } from '@/context/auth/AuthContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getAdminVerifiedUsersCacheKey } from '@/lib/admin/admin-cache';

interface User {
  id: string;
  name: string;
  email: string;
}

const logoVariations = [
  { id: 'root', name: 'Kylrix (Root)', color: '#6366F1' },
  { id: 'vault', name: 'Vault', color: '#10B981' },
  { id: 'note', name: 'Note', color: '#EC4899' },
  { id: 'flow', name: 'Flow', color: '#A855F7' },
  { id: 'connect', name: 'Connect', color: '#F59E0B' }
];

export default function EmailOrchestrator() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [template, setTemplate] = useState(EMAIL_TEMPLATES[0].id);
  const [logoVar, setLogoVar] = useState(logoVariations[0].id);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const { user, getJWT } = useAuth();

  const fetchUsers = useCallback(async (cursorAfter: string | null = null, append = false) => {
    const isInitialLoad = !append;
    if (isInitialLoad) {
      setLoadingUsers(true);
    } else {
      setLoadingMoreUsers(true);
    }

    try {
      setUserLoadError(null);
      const jwt = await getJWT();
      const cacheKey = getAdminVerifiedUsersCacheKey(user?.$id, cursorAfter);

      const fetcher = async () => await getAdminUsersAction({
        verifiedOnly: true,
        limit: 50,
        cursorAfter
      }, jwt || undefined);

      const data = cacheKey
        ? await LocalEngine.query(cacheKey, fetcher, { ttl: 5 * 60 * 1000 })
        : await fetcher();

      const batch = data.users || [];
      setUsers((prev) => {
        if (!append) {
          return batch;
        }

        const seen = new Set(prev.map((u) => u.id));
        const merged = [...prev];

        for (const u of batch) {
          if (seen.has(u.id)) continue;
          seen.add(u.id);
          merged.push(u);
        }

        return merged;
      });
      setNextCursor(data.nextCursor || null);
      setHasMoreUsers(Boolean(data.hasMore));
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      setUserLoadError(error.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
      setLoadingMoreUsers(false);
    }
  }, [user?.$id, getJWT]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTemplate = EMAIL_TEMPLATES.find((item) => item.id === template) || EMAIL_TEMPLATES[0];

  const handleLoadMoreUsers = async () => {
    if (!hasMoreUsers || loadingMoreUsers) return;
    await fetchUsers(nextCursor, true);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const jwt = await getJWT();
      const data = await sendAdminEmailsAction({
        recipientIds: selectedUsers,
        templateId: template,
        subject: customSubject.trim() || selectedTemplate.subject,
        html: customBody.trim() || undefined,
        ctaUrl: '/accounts'}, jwt || undefined);

      setSendResult(`Queued ${data.sent} email(s) successfully.`);
      setSelectedUsers([]);
      setCustomBody('');
      setCustomSubject('');
    } catch (error: any) {
      setSendResult(error.message || 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8 font-satoshi">
        <h2 className="text-2xl md:text-3xl font-black font-clash text-white tracking-tight leading-tight mb-1">
          Email Center
        </h2>
        <p className="text-sm font-bold text-white/60">
          Design and orchestrate branded ecosystem communications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-satoshi text-white">
        {/* Recipient Selection */}
        <div className="rounded-[28px] bg-[#000000] border-2 border-white/20 flex flex-col overflow-hidden min-h-[500px] lg:h-[680px] shadow-2xl">
          <div className="p-4 border-b-2 border-white/20 flex flex-col gap-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users size={18} className="text-[#818CF8]" />
              Recipients
            </h3>
            <input 
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#000000] px-4 py-2.5 rounded-xl border-2 border-white/20 text-white text-sm font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none transition-all placeholder:text-white/40 font-mono"
            />
            <button 
              type="button"
              onClick={handleSelectAll}
              className="text-left text-xs font-black text-[#818CF8] hover:text-white transition-colors cursor-pointer w-fit uppercase tracking-wider font-mono"
            >
              {selectedUsers.length === filteredUsers.length ? 'Deselect All' : `Select All (${filteredUsers.length})`}
            </button>
          </div>
          
          <div className="flex-grow overflow-y-auto divide-y-2 divide-white/10 max-h-[300px] lg:max-h-none">
            {loadingUsers ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6366F1]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/50 font-black font-mono">
                No users found.
              </div>
            ) : filteredUsers.map((u) => (
              <div 
                key={u.id}
                onClick={() => handleToggleUser(u.id)}
                className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 border-2 border-[#6366F1] shadow-md">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white truncate">{u.name}</h4>
                    <p className="text-[11px] font-mono text-white/50 truncate">{u.email}</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => {}} // toggled by row click
                  className="rounded-md border-2 border-white/20 bg-[#000000] text-[#6366F1] focus:ring-[#6366F1]/30 cursor-pointer h-4 w-4"
                />
              </div>
            ))}
          </div>

          <div className="p-3 border-t-2 border-white/20">
            {userLoadError && (
              <p className="mb-2 text-rose-400 text-xs font-bold">{userLoadError}</p>
            )}
            <button
              type="button"
              onClick={handleLoadMoreUsers}
              disabled={!hasMoreUsers || loadingMoreUsers || loadingUsers}
              className="w-full py-2.5 rounded-xl border-2 border-white/20 text-xs font-black text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30"
            >
              {loadingMoreUsers ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mx-auto" />
              ) : hasMoreUsers ? (
                `Load more verified users (${users.length})`
              ) : (
                'All verified users loaded'
              )}
            </button>
          </div>
          
          <div className="p-3 bg-[#6366F1]/15 border-t-2 border-white/20 text-center">
            <span className="text-xs font-black text-white font-mono uppercase tracking-wider">
              {selectedUsers.length} Users Selected
            </span>
          </div>
        </div>

        {/* Email Designer */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-[28px] bg-[#000000] border-2 border-white/20 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Layout size={18} className="text-[#818CF8]" />
              Rich Orchestrator
            </h3>
            <div className="flex gap-2">
              <button 
                type="button"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-white/20 text-white font-extrabold text-xs hover:bg-white/10 hover:border-white/40 transition-all cursor-pointer"
              >
                <Eye size={16} />
                <span>Preview</span>
              </button>
              <button 
                type="button"
                onClick={handleSend}
                disabled={selectedUsers.length === 0 || sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all duration-200 cursor-pointer disabled:opacity-40 border-2 border-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.35)]"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <Send size={16} />
                )}
                <span>Send Orchestration</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/50 font-black font-mono uppercase tracking-wider block">Select Template</span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as EmailTemplateId)}
                className="w-full bg-[#000000] px-4 py-3 rounded-xl border-2 border-white/20 text-white text-xs font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none cursor-pointer transition-all duration-200"
              >
                {EMAIL_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#000000]">{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/50 font-black font-mono uppercase tracking-wider block">Logo Variation</span>
              <select
                value={logoVar}
                onChange={(e) => setLogoVar(e.target.value)}
                className="w-full bg-[#000000] px-4 py-3 rounded-xl border-2 border-white/20 text-white text-xs font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none cursor-pointer transition-all duration-200"
              >
                {logoVariations.map(l => (
                  <option key={l.id} value={l.id} className="bg-[#000000]">{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-white/50 font-black font-mono uppercase tracking-wider block">Email Subject</span>
            <input 
              type="text"
              placeholder="Enter custom subject or use template default"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full bg-[#000000] px-4 py-3 rounded-xl border-2 border-white/20 text-white text-sm font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none transition-all placeholder:text-white/40 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-white/50 font-black font-mono uppercase tracking-wider block">Email Content</span>
            <textarea 
              rows={8}
              placeholder="The template will be used, but you can inject custom HTML or text here..."
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full bg-[#000000] px-4 py-3.5 rounded-xl border-2 border-white/20 text-white text-xs font-bold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/20 focus:outline-none transition-all placeholder:text-white/40 font-mono leading-relaxed"
            />
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex gap-3 items-center">
            <CheckCircle2 className="text-[#10B981] w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold text-white/80 leading-normal">
              This orchestration will be delivered with <strong>E2EE Signing</strong> and Kylrix branded metadata.
            </p>
          </div>

          {sendResult && (
            <div className="p-4 rounded-2xl bg-[#6366F1]/20 border-2 border-[#6366F1]/40">
              <p className="text-xs font-black text-white leading-normal">{sendResult}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
