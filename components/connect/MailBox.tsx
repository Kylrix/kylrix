'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Send, Inbox, Star, Trash2, Edit3, Search, ChevronRight, Paperclip, Copy } from 'lucide-react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { NostrRelayPool, signEvent, NostrEvent } from '@/lib/tmp/nostr';
import { buildEnvelope, wrapForNostr } from '@/lib/tmp/builder';
import { resolveIdentifier } from '@/lib/tmp/resolver';
import { decodeEnvelope } from '@/lib/tmp/codec';
import { bytesToHex, hexToBytes, bytesToNpub } from '@/lib/tmp/crypto';
import * as secp256k1 from '@noble/secp256k1';
import toast from 'react-hot-toast';

interface EmailMessage {
  id: string;
  sender: string;
  senderName: string;
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isStarred?: boolean;
  body: string;
}

const RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
];

export function MailBox() {
  const { identity, loading: identityLoading, isVaultLocked, unlockAndLoad } = useNostrIdentity();

  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'starred' | 'trash'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [loadingMail, setLoadingMail] = useState(false);

  // Compose State
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const poolRef = useRef<NostrRelayPool | null>(null);

  // Compose State live drafts sync
  useEffect(() => {
    try {
      const cachedDraft = localStorage.getItem('kylrix_mail_draft');
      if (cachedDraft) {
        const parsed = JSON.parse(cachedDraft);
        setComposeTo(parsed.composeTo || '');
        setComposeSubject(parsed.composeSubject || '');
        setComposeBody(parsed.composeBody || '');
        if (parsed.composeTo || parsed.composeSubject || parsed.composeBody) {
          setIsComposing(true);
        }
      }
    } catch (e) {
      console.warn('Failed to load mail draft:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kylrix_mail_draft', JSON.stringify({ composeTo, composeSubject, composeBody }));
    } catch (e) {}
  }, [composeTo, composeSubject, composeBody]);

  // Load emails from localStorage cache on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tendon_emails_cache');
      if (saved) {
        setEmails(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  // Save emails to localStorage cache when updated
  useEffect(() => {
    if (emails.length > 0) {
      try {
        localStorage.setItem('tendon_emails_cache', JSON.stringify(emails));
      } catch (e) {}
    }
  }, [emails]);

  // Setup relay pool and listen for Kind 1059 unicast mails
  useEffect(() => {
    if (!identity) return;

    setLoadingMail(true);
    const pool = new NostrRelayPool(RELAYS);
    poolRef.current = pool;
    pool.connect();

    const userHexPubkey = bytesToHex(secp256k1.schnorr.getPublicKey(identity.privateKeyBytes));

    const handleMailEvent = (event: NostrEvent) => {
      if (event.kind === 1059) {
        const isRecipient = event.tags.some(tag => tag[0] === 'p' && tag[1] === userHexPubkey);
        const isSender = event.pubkey === userHexPubkey;

        if (isRecipient || isSender) {
          try {
            // Decode Tendon envelope
            const decoded = decodeEnvelope(event.content);
            if (decoded && decoded.payload && decoded.payload.kind === 'unicast_mail') {
              const mailVal = decoded.payload.value;
              const newMail: EmailMessage = {
                id: event.id,
                sender: isSender ? identity.npub : bytesToNpub(hexToBytes(event.pubkey)),
                senderName: isSender ? 'You (me)' : `User ${event.pubkey.substring(0, 6)}`,
                subject: mailVal.subject || '(No Subject)',
                preview: (mailVal.body_plaintext || '').substring(0, 80) + '...',
                body: mailVal.body_plaintext || '',
                date: new Date(decoded.dispatch_timestamp_utc || event.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isRead: isSender
              };

              setEmails(prev => {
                if (prev.some(m => m.id === newMail.id)) return prev;
                return [newMail, ...prev];
              });
            }
          } catch (e) {
            console.error('Failed to decode incoming unicast envelope:', e);
          }
        }
      }
    };

    pool.addListener(handleMailEvent);

    // Subscribe to unicast mails addressed to our pubkey hex or sent by us
    pool.subscribe('tendon-inbox-subscription', [
      { kinds: [1059], '#p': [userHexPubkey], limit: 50 },
      { kinds: [1059], authors: [userHexPubkey], limit: 50 }
    ]);
    setLoadingMail(false);

    return () => {
      pool.removeListener(handleMailEvent);
      pool.unsubscribe('tendon-inbox-subscription');
      pool.close();
    };
  }, [identity]);

  const handleCopyNpub = () => {
    if (identity) {
      navigator.clipboard.writeText(identity.npub);
      toast.success('Public key (npub) copied to clipboard!');
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error('All fields are required');
      return;
    }

    if (!identity || !poolRef.current) {
      toast.error('Cryptographic identity not active');
      return;
    }

    try {
      toast.loading('Resolving recipient identifier...', { id: 'send-mail' });
      // 1. Resolve recipient identifier using active host environment
      const defaultDomain = typeof window !== 'undefined' ? window.location.host : 'kylrix.space';
      const resolved = await resolveIdentifier(composeTo, defaultDomain);

      // 2. Build Tendon envelope
      const tendonEnvelope = buildEnvelope({
        kind: "unicast_mail",
        value: {
          message_id: crypto.randomUUID(),
          thread_id: crypto.randomUUID(),
          subject: composeSubject,
          body_plaintext: composeBody,
          cc_recipients_npub: [],
          attachments: []
        }
      });

      // 3. Wrap envelope for Nostr Kind 1059
      const wrapped = wrapForNostr(tendonEnvelope, [["p", resolved.hex]]);

      // 4. Sign the Nostr event using schnorr
      const signed = signEvent({
        pubkey: bytesToHex(secp256k1.schnorr.getPublicKey(identity.privateKeyBytes)),
        created_at: wrapped.created_at_unix,
        kind: wrapped.kind,
        tags: wrapped.tags,
        content: wrapped.content_base64
      }, identity.privateKeyBytes);

      // 5. Publish to Nostr relay pool
      await poolRef.current.publish(signed);

      // Optimistically add to sent list locally
      const newMail: EmailMessage = {
        id: signed.id,
        sender: identity.npub,
        senderName: 'You (me)',
        subject: composeSubject,
        preview: composeBody.substring(0, 80) + '...',
        body: composeBody,
        date: 'Just now',
        isRead: true
      };

      setEmails(prev => [newMail, ...prev]);
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      try {
        localStorage.removeItem('kylrix_mail_draft');
      } catch (e) {}
      toast.success('Encrypted unicast mail signed and published to relays!', { id: 'send-mail' });
    } catch (err: any) {
      console.error('Failed to send TMP mail:', err);
      toast.error(err.message || 'Failed to send mail', { id: 'send-mail' });
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          email.senderName.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFolder === 'starred') return matchesSearch && email.isStarred;
    if (activeFolder === 'sent') return matchesSearch && email.sender === identity?.npub;
    return matchesSearch && email.sender !== identity?.npub;
  });

  if (isVaultLocked || !identity) {
    return (
      <div className="w-full bg-[#161412] border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] text-white shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-[#F59E0B] flex items-center justify-center mb-6">
          <Mail size={32} className="animate-pulse" />
        </div>
        <h3 className="text-xl font-black font-clash mb-2">Sovereign Inbox Encrypted</h3>
        <p className="text-sm text-white/50 max-w-sm mb-8 font-satoshi">
          To read and sign emails securely via the Tendon Messaging Protocol Relays, you must unlock your local secure vault using your MasterPass.
        </p>
        <button
          onClick={unlockAndLoad}
          disabled={identityLoading}
          className="px-6 py-3 bg-[#F59E0B] hover:bg-[#D97706] disabled:bg-amber-500/50 text-white font-extrabold rounded-2xl transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
        >
          {identityLoading ? 'Initializing relays...' : 'Unlock Sovereign Vault'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#161412] border border-white/5 rounded-3xl overflow-hidden min-h-[60vh] flex flex-col md:flex-row text-white font-satoshi shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
      {/* Side Navigation */}
      <div className="w-full md:w-56 bg-[#0B0A09] border-r border-white/5 p-4 flex flex-col gap-2 flex-shrink-0 select-none">
        <button 
          onClick={() => setIsComposing(true)}
          className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 mb-4 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
        >
          <Edit3 size={16} />
          Compose
        </button>

        <button 
          onClick={() => { setActiveFolder('inbox'); setSelectedEmail(null); }}
          className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all ${activeFolder === 'inbox' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
        >
          <Inbox size={16} />
          Inbox
        </button>
        <button 
          onClick={() => { setActiveFolder('starred'); setSelectedEmail(null); }}
          className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all ${activeFolder === 'starred' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
        >
          <Star size={16} />
          Starred
        </button>
        <button 
          onClick={() => { setActiveFolder('sent'); setSelectedEmail(null); }}
          className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all ${activeFolder === 'sent' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
        >
          <Send size={16} />
          Sent
        </button>
        <button 
          onClick={() => { setActiveFolder('trash'); setSelectedEmail(null); }}
          className={`w-full py-2.5 px-4 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all ${activeFolder === 'trash' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
        >
          <Trash2 size={16} />
          Trash
        </button>

        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1.5 text-[9px] font-mono text-white/30">
          <div className="flex items-center gap-1.5 text-[#10B981]">
            <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            TMP Relays connected
          </div>
          <div className="flex flex-col gap-1 bg-white/[0.02] border border-white/5 p-2 rounded-xl">
            <span className="truncate text-white/50">My npub:</span>
            <span className="truncate text-white/80">{identity.npub}</span>
            <button
              onClick={handleCopyNpub}
              className="mt-1 py-1 px-2 bg-white/5 hover:bg-white/10 text-white hover:text-white/90 border border-white/10 rounded flex items-center justify-center gap-1 text-[8px] uppercase tracking-wider font-sans transition-all"
            >
              <Copy size={8} />
              Copy npub
            </button>
          </div>
        </div>
      </div>

      {/* Main Mail Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isComposing ? (
          <form onSubmit={handleSendMail} className="p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#F59E0B]">New Encrypted Mail</h3>
              <button 
                type="button" 
                onClick={() => setIsComposing(false)}
                className="text-xs text-white/40 hover:text-white"
              >
                Cancel
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Recipient (npub or email)</label>
              <input 
                type="text" 
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                placeholder="username@domain.com or npub..."
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/10"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Subject</label>
              <input 
                type="text" 
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Encrypted subject line..."
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/10"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1 min-h-[200px]">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Message</label>
              <textarea 
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your secure message..."
                className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/10 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button type="button" className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
                <Paperclip size={18} />
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 bg-white text-black font-extrabold rounded-xl hover:bg-white/90 transition-all flex items-center gap-2"
              >
                <Send size={14} />
                Send encrypted
              </button>
            </div>
          </form>
        ) : selectedEmail ? (
          <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-xs text-[#F59E0B] hover:underline"
              >
                &larr; Back to inbox
              </button>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white">
                  <Star size={14} className={selectedEmail.isStarred ? 'fill-[#F59E0B] text-[#F59E0B]' : ''} />
                </button>
                <button className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black font-clash mb-2">{selectedEmail.subject}</h2>
              <div className="flex justify-between items-center text-xs text-white/40">
                <span>From: <strong className="text-white/60">{selectedEmail.senderName}</strong> ({selectedEmail.sender})</span>
                <span>{selectedEmail.date}</span>
              </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-sans text-white/80">
              {selectedEmail.body}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search bar */}
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <Search size={16} className="text-white/30" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search mail..."
                className="w-full bg-transparent text-sm focus:outline-none placeholder-white/30"
              />
            </div>

            {/* Mail lists */}
            <div className="flex-1 overflow-y-auto">
              {loadingMail && emails.length === 0 ? (
                <div className="text-center py-20 text-white/40">
                  <span className="animate-spin inline-block w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full mb-3" />
                  <p className="text-xs font-mono">Syncing inbox from relays...</p>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/30 select-none">
                  <Mail size={40} className="stroke-[1.5]" />
                  <span className="text-xs font-mono uppercase tracking-wider">No mail messages found</span>
                </div>
              ) : (
                filteredEmails.map(email => (
                  <div 
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className="p-4 border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer flex gap-4 items-start transition-all"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${email.isRead ? 'bg-transparent' : 'bg-[#F59E0B]'}`} />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-white truncate max-w-[200px]">{email.senderName}</span>
                        <span className="text-[10px] text-white/30 font-mono">{email.date}</span>
                      </div>
                      <span className="text-xs font-semibold text-white/90 truncate">{email.subject}</span>
                      <span className="text-xs text-white/40 truncate">{email.preview}</span>
                    </div>
                    <ChevronRight size={14} className="text-white/20 self-center" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
