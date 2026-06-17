"use client";

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Layout, 
  Users,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { EMAIL_TEMPLATES } from '@/lib/email-template-catalog';
import { getAdminUsersAction } from '../../actions/admin';
import { sendAdminEmailsAction } from '../../actions/emails';
import { useAuth } from '@/context/auth/AuthContext';

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
  const { getJWT } = useAuth();

  const fetchUsers = async (cursorAfter: string | null = null, append = false) => {
    const isInitialLoad = !append;
    if (isInitialLoad) {
      setLoadingUsers(true);
    } else {
      setLoadingMoreUsers(true);
    }

    try {
      setUserLoadError(null);
      const jwt = await getJWT();
      const data = await getAdminUsersAction({
        verifiedOnly: true,
        limit: 50,
        cursorAfter,
      }, jwt || undefined);
      const batch = data.users || [];
      setUsers((prev) => {
        if (!append) {
          return batch;
        }

        const seen = new Set(prev.map((user) => user.id));
        const merged = [...prev];

        for (const user of batch) {
          if (seen.has(user.id)) continue;
          seen.add(user.id);
          merged.push(user);
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
  };

  useEffect(() => {
    void fetchUsers();
  }, [getJWT]);

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
        ctaUrl: '/accounts',
      }, jwt || undefined);

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
        <p className="text-sm text-white/40">
          Design and orchestrate branded ecosystem communications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-satoshi text-white">
        {/* Recipient Selection */}
        <div className="rounded-[24px] bg-[#161412] border border-white/5 flex flex-col overflow-hidden min-h-[500px] lg:h-[680px]">
          <div className="p-4 border-b border-white/5 flex flex-col gap-3">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Users size={18} className="text-[#6366F1]" />
              Recipients
            </h3>
            <input 
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] px-4 py-2.5 rounded-xl border border-white/5 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all placeholder:text-white/30"
            />
            <button 
              type="button"
              onClick={handleSelectAll}
              className="text-left text-xs font-bold text-[#6366F1] hover:text-[#5254E8] transition-colors cursor-pointer w-fit"
            >
              {selectedUsers.length === filteredUsers.length ? 'Deselect All' : `Select All (${filteredUsers.length})`}
            </button>
          </div>
          
          <div className="flex-grow overflow-y-auto divide-y divide-white/[0.02] max-h-[300px] lg:max-h-none">
            {loadingUsers ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6366F1]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40 font-bold">
                No users found.
              </div>
            ) : filteredUsers.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleToggleUser(user.id)}
                className="flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-black text-xs flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                    <p className="text-xs text-white/45 truncate">{user.email}</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => {}} // toggled by row click
                  className="rounded border-white/10 bg-[#0A0908] text-[#6366F1] focus:ring-[#6366F1]/20 cursor-pointer h-4 w-4"
                />
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/5">
            {userLoadError && (
              <p className="mb-2 text-red-400 text-xs font-bold">{userLoadError}</p>
            )}
            <button
              type="button"
              onClick={handleLoadMoreUsers}
              disabled={!hasMoreUsers || loadingMoreUsers || loadingUsers}
              className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-extrabold text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30"
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
          
          <div className="p-3 bg-[#6366F1]/[0.03] border-t border-white/5 text-center">
            <span className="text-xs font-extrabold text-[#6366F1]">
              {selectedUsers.length} Users Selected
            </span>
          </div>
        </div>

        {/* Email Designer */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-[24px] bg-[#161412] border border-white/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Layout size={18} className="text-[#6366F1]" />
              Rich Orchestrator
            </h3>
            <div className="flex gap-2">
              <button 
                type="button"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold text-xs hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer"
              >
                <Eye size={16} />
                <span>Preview</span>
              </button>
              <button 
                type="button"
                onClick={handleSend}
                disabled={selectedUsers.length === 0 || sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all duration-200 cursor-pointer disabled:opacity-40 shadow-[0_8px_30px_rgba(99,102,241,0.2)]"
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
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Select Template</span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as EmailTemplateId)}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none cursor-pointer transition-all duration-200 animate-fadeIn"
              >
                {EMAIL_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#161412]">{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Logo Variation</span>
              <select
                value={logoVar}
                onChange={(e) => setLogoVar(e.target.value)}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none cursor-pointer transition-all duration-200"
              >
                {logoVariations.map(l => (
                  <option key={l.id} value={l.id} className="bg-[#161412]">{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Email Subject</span>
            <input 
              type="text"
              placeholder="Enter custom subject or use template default"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full bg-white/[0.02] px-4 py-3 rounded-xl border border-white/5 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all placeholder:text-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Email Content</span>
            <textarea 
              rows={8}
              placeholder="The template will be used, but you can inject custom HTML or text here..."
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full bg-white/[0.02] px-4 py-3.5 rounded-xl border border-white/5 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all placeholder:text-white/30 font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 flex gap-3 items-center">
            <CheckCircle2 className="text-[#10B981] w-5 h-5 flex-shrink-0" />
            <p className="text-xs text-white/60 leading-normal">
              This orchestration will be delivered with <strong>E2EE Signing</strong> and Kylrix branded metadata.
            </p>
          </div>

          {sendResult && (
            <div className="p-4 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/20">
              <p className="text-xs font-bold text-white leading-normal">{sendResult}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
