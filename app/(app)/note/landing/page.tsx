"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useInView } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Check,
  Flag,
  Clock,
  ListTodo,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Lock,
  Zap,
  StickyNote,
  MessageSquare,
  Fingerprint,
  Shield,
  Globe,
  Layers,
  Terminal,
} from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { Logo } from '@/components/Logo';

// ─── DUMMY DATA ─────────────────────────────────────────────────

const DUMMY_NOTES = [
  { id: '1', title: 'Q3 Product Roadmap', preview: 'Prioritize real-time collab features. Ship WebRTC huddles by July...', color: '#F59E0B', tags: ['product', 'roadmap'], time: '2m ago', encrypted: true },
  { id: '2', title: 'Architecture Decision Record', preview: 'Migrate all storage adapters to unified Table/Row pattern...', color: '#EC4899', tags: ['engineering'], time: '14m ago', encrypted: false },
  { id: '3', title: 'Investor Update Draft', preview: 'ARR grew 340% QoQ. Zero churn on enterprise tier...', color: '#6366F1', tags: ['finance', 'confidential'], time: '1h ago', encrypted: true },
];

const DUMMY_TASKS = [
  { id: '1', title: 'Ship zero-knowledge sync engine', priority: 'urgent' as const, status: 'in_progress', dueDate: 'Today', project: 'CORE', projectColor: '#6366F1', subtasks: '3/5', comments: 4 },
  { id: '2', title: 'Design onboarding flow v2', priority: 'high' as const, status: 'todo', dueDate: 'Tomorrow', project: 'DESIGN', projectColor: '#EC4899', subtasks: '0/3', comments: 1 },
  { id: '3', title: 'Audit rate-limiting middleware', priority: 'medium' as const, status: 'done', dueDate: 'Yesterday', project: 'SECURITY', projectColor: '#10B981', subtasks: '4/4', comments: 7 },
];

const DUMMY_MOMENTS = [
  { id: '1', user: 'Aria Chen', avatar: 'AC', caption: 'Just shipped the new encrypted note sharing. Zero-knowledge, end-to-end. Your secrets stay yours. 🔐', likes: 42, replies: 8, repulses: 3, time: '3m', color: '#F59E0B' },
  { id: '2', user: 'Marcus Webb', avatar: 'MW', caption: 'The new Flow dashboard is insane. Tasks, events, forms — all in one view. Productivity level: maximum.', likes: 28, replies: 5, repulses: 1, time: '12m', color: '#A855F7' },
];

const DUMMY_HUDDLE_PARTICIPANTS = [
  { name: 'Aria Chen', initials: 'AC', speaking: true, muted: false, videoOn: true },
  { name: 'Marcus Webb', initials: 'MW', speaking: false, muted: true, videoOn: false },
  { name: 'Luna Park', initials: 'LP', speaking: false, muted: false, videoOn: true },
  { name: 'Dev Patel', initials: 'DP', speaking: true, muted: false, videoOn: false },
];

const DUMMY_VAULT_ENTRIES = [
  { site: 'github.com', username: 'aria@kylrix.space', strength: 98, lastUsed: '2h ago' },
  { site: 'figma.com', username: 'design@kylrix.space', strength: 95, lastUsed: '4h ago' },
  { site: 'aws.amazon.com', username: 'ops@kylrix.space', strength: 100, lastUsed: '1d ago' },
];

// ─── PRIORITY SYSTEM ────────────────────────────────────────────

const priorityColors: Record<string, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

const priorityLabels: Record<string, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  urgent: 'URGENT',
};

// ─── TYPING ANIMATION HOOK ─────────────────────────────────────

function useTypingEffect(texts: string[], speed = 40, pause = 2000) {
  const [displayed, setDisplayed] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = texts[textIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < current.length) {
          setDisplayed(current.slice(0, charIndex + 1));
          setCharIndex(c => c + 1);
        } else {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        if (charIndex > 0) {
          setDisplayed(current.slice(0, charIndex - 1));
          setCharIndex(c => c - 1);
        } else {
          setIsDeleting(false);
          setTextIndex(i => (i + 1) % texts.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, texts, speed, pause]);

  return displayed;
}

// ─── LIVE NOTE CARD ─────────────────────────────────────────────

function LiveNoteCard({ note, index }: { note: typeof DUMMY_NOTES[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group"
    >
      <div className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
        isHovered ? 'bg-[#1C1A18] border-[#34322F] -translate-y-1' : 'bg-[#161412] border-[#1C1A18]'
      }`}
      style={{ boxShadow: isHovered ? '0 12px 24px -8px rgba(0,0,0,0.8)' : '0 4px 4px -4px rgba(0,0,0,0.9)' }}
      >
        {/* Encrypted badge */}
        {note.encrypted && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
            <Lock size={10} className="text-[#10B981]" />
            <span className="font-mono text-[8px] font-bold text-[#10B981] tracking-wider">PRIVATE</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-10 rounded-full shrink-0 mt-0.5 transition-all duration-300"
              style={{ backgroundColor: note.color, opacity: isHovered ? 1 : 0.6 }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-satoshi font-bold text-sm text-[#F5F2ED] mb-1 truncate">{note.title}</h4>
              <p className="font-satoshi text-xs text-[#9B9691] leading-relaxed line-clamp-2">{note.preview}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {note.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-[#1C1A18] border border-[#2C2A28] font-mono text-[9px] font-bold text-[#9B9691] tracking-wider uppercase">{tag}</span>
              ))}
            </div>
            <span className="font-mono text-[10px] text-[#9B9691]/60">{note.time}</span>
          </div>
        </div>

        {/* Typing cursor animation */}
        <motion.div
          className="absolute bottom-2 right-4 w-0.5 h-3 rounded-full"
          style={{ backgroundColor: note.color }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
    </motion.div>
  );
}

// ─── LIVE TASK ITEM ─────────────────────────────────────────────

function LiveTaskItem({ task, index }: { task: typeof DUMMY_TASKS[0]; index: number }) {
  const [checked, setChecked] = useState(task.status === 'done');
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 cursor-pointer relative group ${
        isHovered ? 'bg-[#1C1A18] border-[#34322F] -translate-y-0.5' : 'bg-[#161412] border-[#1C1A18]'
      } ${checked ? 'opacity-60' : 'opacity-100'}`}
      style={{ boxShadow: isHovered ? '0 8px 10px -8px rgba(0,0,0,1)' : '0 4px 4px -4px rgba(0,0,0,0.9)' }}
    >
      {/* Priority ribbon */}
      <div
        className="absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md transition-all duration-300 opacity-60 group-hover:opacity-100"
        style={{ backgroundColor: priorityColors[task.priority] }}
      />

      <div className="flex items-start gap-3 pl-1">
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setChecked(!checked); }}
          className={`flex items-center justify-center h-5 w-5 mt-0.5 rounded-full border transition-all duration-200 hover:scale-110 cursor-pointer shrink-0 ${
            checked ? 'border-[#A855F7] bg-[#A855F7] text-[#0A0908]' : 'border-[#34322F] text-[#9B9691]'
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </button>

        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className={`font-satoshi font-bold text-sm tracking-tight ${
              checked ? 'text-[#9B9691] line-through' : 'text-[#F5F2ED]'
            }`}>{task.title}</span>

            <div className="flex items-center gap-2 text-[#9B9691] opacity-80 shrink-0">
              <div className="flex items-center gap-1">
                <ListTodo className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold">{task.subtasks}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold">{task.comments}</span>
              </div>
            </div>
          </div>

          {/* Meta footer */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 rounded-lg border bg-[#1C1A18] border-[#2C2A28] px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.projectColor }} />
              <span className="font-mono font-bold text-[9px] text-[#9B9691] tracking-wider">{task.project}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-[#1C1A18] border-[#2C2A28] px-2 py-0.5">
              <Flag className="h-3 w-3" style={{ color: priorityColors[task.priority] }} />
              <span className="font-mono font-bold text-[9px] tracking-wider" style={{ color: priorityColors[task.priority] }}>
                {priorityLabels[task.priority]}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-[#1C1A18] border-[#2C2A28] px-2 py-0.5">
              <Clock className="h-3 w-3" style={{ color: task.dueDate === 'Today' ? '#f59e0b' : task.dueDate === 'Yesterday' ? '#ef4444' : '#A1A1AA' }} />
              <span className="font-mono font-bold text-[9px] tracking-wider" style={{ color: task.dueDate === 'Today' ? '#f59e0b' : task.dueDate === 'Yesterday' ? '#ef4444' : '#A1A1AA' }}>
                {task.dueDate.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── LIVE MOMENT CARD ───────────────────────────────────────────

function LiveMomentCard({ moment, index }: { moment: typeof DUMMY_MOMENTS[0]; index: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(moment.likes);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="p-5 rounded-[20px] bg-[#161412] border border-[#1C1A18] hover:border-[#34322F] transition-all duration-300 cursor-pointer"
      style={{ boxShadow: '0 4px 4px -4px rgba(0,0,0,0.9)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-clash font-bold text-sm text-black"
          style={{ backgroundColor: moment.color }}
        >
          {moment.avatar}
        </div>
        <div className="flex-1">
          <span className="font-satoshi font-bold text-sm text-[#F5F2ED]">{moment.user}</span>
          <span className="font-mono text-[10px] text-[#9B9691]/60 ml-2">{moment.time}</span>
        </div>
      </div>

      {/* Caption */}
      <p className="font-satoshi text-sm text-[#C7C2BC] leading-relaxed mb-4">{moment.caption}</p>

      {/* Action bar */}
      <div className="flex items-center gap-6 text-[#9B9691]">
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); }}
          className="flex items-center gap-1.5 transition-colors hover:text-[#F43F5E] cursor-pointer"
        >
          <Heart size={16} className={liked ? 'fill-[#F43F5E] text-[#F43F5E]' : ''} />
          <span className="font-mono text-xs font-bold">{likeCount}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <MessageCircle size={16} />
          <span className="font-mono text-xs font-bold">{moment.replies}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Repeat2 size={16} />
          <span className="font-mono text-xs font-bold">{moment.repulses}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── LIVE HUDDLE PANEL ──────────────────────────────────────────

function LiveHuddlePanel() {
  const [elapsed, setElapsed] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const cycle = setInterval(() => setActiveSpeaker(s => (s + 1) % DUMMY_HUDDLE_PARTICIPANTS.length), 3000);
    return () => clearInterval(cycle);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl bg-[#161412] border border-[#1C1A18] overflow-hidden"
      style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping opacity-30" />
          </div>
          <span className="font-clash font-bold text-sm text-white">Team Standup</span>
          <span className="font-mono text-[10px] text-[#9B9691]">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-[#9B9691]" />
          <span className="font-mono text-xs font-bold text-[#9B9691]">{DUMMY_HUDDLE_PARTICIPANTS.length}</span>
        </div>
      </div>

      {/* Participant Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {DUMMY_HUDDLE_PARTICIPANTS.map((p, i) => (
          <div
            key={p.name}
            className={`relative rounded-2xl border transition-all duration-500 flex flex-col items-center justify-center py-6 px-3 ${
              activeSpeaker === i
                ? 'bg-[#F59E0B]/5 border-[#F59E0B]/30'
                : 'bg-[#0B0A09] border-[#1C1A18]'
            }`}
            style={activeSpeaker === i ? { boxShadow: '0 0 16px rgba(245, 158, 11, 0.15)' } : undefined}
          >
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-clash font-bold text-sm mb-2 transition-all duration-500 ${
              activeSpeaker === i ? 'ring-2 ring-[#F59E0B]/40 scale-105' : ''
            }`} style={{ backgroundColor: activeSpeaker === i ? '#F59E0B' : '#34322F', color: activeSpeaker === i ? '#0A0908' : '#9B9691' }}>
              {p.initials}
            </div>
            <span className="font-satoshi text-xs text-[#9B9691] font-bold truncate w-full text-center">{p.name.split(' ')[0]}</span>

            {/* Audio wave indicator */}
            {activeSpeaker === i && (
              <div className="absolute top-2 right-2 flex items-end gap-0.5 h-3">
                {[0.6, 1, 0.4, 0.8, 0.5].map((h, j) => (
                  <motion.div
                    key={j}
                    className="w-0.5 rounded-full bg-[#F59E0B]"
                    animate={{ height: [`${h * 12}px`, `${h * 4}px`, `${h * 12}px`] }}
                    transition={{ duration: 0.5 + j * 0.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            )}

            {/* Muted indicator */}
            {p.muted && (
              <div className="absolute bottom-2 right-2">
                <MicOff size={10} className="text-[#EF4444]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="px-5 py-4 border-t border-white/5 flex items-center justify-center gap-3">
        {[
          { icon: Mic, active: true, color: '#F5F2ED' },
          { icon: Video, active: true, color: '#F5F2ED' },
          { icon: PhoneOff, active: false, color: '#EF4444', bg: '#EF4444' },
        ].map((ctrl, i) => (
          <button
            key={i}
            className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer hover:scale-105 ${
              ctrl.bg ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]' : 'bg-[#1C1A18] border-[#2C2A28] text-white'
            }`}
          >
            <ctrl.icon size={18} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── LIVE VAULT PREVIEW ─────────────────────────────────────────

function LiveVaultPreview() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col gap-2"
    >
      {DUMMY_VAULT_ENTRIES.map((entry, i) => (
        <motion.div
          key={entry.site}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15 }}
          className="p-4 rounded-2xl bg-[#161412] border border-[#1C1A18] hover:border-[#34322F] transition-all duration-200 flex items-center gap-4 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-[#A855F7]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-satoshi font-bold text-sm text-[#F5F2ED]">{entry.site}</div>
            <div className="font-mono text-[10px] text-[#9B9691] mt-0.5">{'•'.repeat(16)}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 rounded-full bg-[#1C1A18] overflow-hidden">
                <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${entry.strength}%` }} />
              </div>
              <span className="font-mono text-[9px] font-bold text-[#10B981]">{entry.strength}%</span>
            </div>
            <span className="font-mono text-[9px] text-[#9B9691]/50">{entry.lastUsed}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── ORBITING PARTICLES ─────────────────────────────────────────

function OrbitingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            backgroundColor: ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#A855F7'][i % 5],
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.1, 0.5, 0.1],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── SECTION WRAPPER ────────────────────────────────────────────

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ─── ECOSYSTEM APP CARDS ────────────────────────────────────────

const APPS = [
  { id: 'note', label: 'Note', color: '#F59E0B', desc: 'Encrypted research workspace. Write, link, and share with zero-knowledge privacy.' },
  { id: 'vault', label: 'Vault', color: '#A855F7', desc: 'Passwords, 2FA codes, and keys. Protected behind your master passphrase.' },
  { id: 'flow', label: 'Flow', color: '#10B981', desc: 'Goals, events, and forms. Everything you need to orchestrate your day.' },
  { id: 'connect', label: 'Connect', color: '#F43F5E', desc: 'Encrypted messaging, live huddles, and a social feed for your ecosystem.' },
];

// ─── MAIN LANDING PAGE ──────────────────────────────────────────

export default function LandingPage() {
  const { openIDMWindow, isAuthenticated, isAuthenticating } = useAuth();
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.96]);

  const typedText = useTypingEffect([
    'Your notes. Private.',
    'Your passwords. Sealed.',
    'Your tasks. Organized.',
    'Your calls. Encrypted.',
    'Your ecosystem. Unified.',
  ], 50, 2500);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('stay')) return;
    if (isAuthenticated) {
      router.replace('/note');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#0A0908] text-white/90 flex flex-col font-satoshi relative overflow-x-hidden">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-[100vh] flex flex-col items-center justify-center px-6 py-20"
      >
        <OrbitingParticles />

        {/* Ambient gradient */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-[#6366F1]/30 bg-[#6366F1]/5 text-[#6366F1]">
              <Sparkles size={12} />
              <span>One workspace. Infinite depth.</span>
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-4xl sm:text-6xl md:text-8xl font-black font-clash leading-[1.05] sm:leading-[0.95] tracking-tight px-4 sm:px-0"
          >
            <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">
              your productivity tools and agent...
            </span>
            <br className="hidden sm:inline" />
            <span className="text-[#6366F1] block sm:inline mt-2 sm:mt-0">all in one workspace</span>
          </motion.h1>

          {/* Typing line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="h-8 flex items-center justify-center px-4"
          >
            <span className="font-mono text-sm md:text-lg text-white/40 text-center">
              {typedText}
              <span className="inline-block w-0.5 h-4 md:h-5 bg-[#6366F1] ml-0.5 align-middle animate-pulse" />
            </span>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 w-full max-w-xs sm:max-w-md px-4 sm:px-0"
          >
            <button
              onClick={() => openIDMWindow()}
              disabled={isAuthenticating}
              className="w-full sm:flex-1 px-6 sm:px-8 py-3.5 sm:py-4 bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl transition-all duration-200 shadow-[0_0_40px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 cursor-pointer hover:shadow-[0_0_60px_rgba(99,102,241,0.4)]"
            >
              Get Started Free
            </button>
            <NextLink
              href="/docs"
              className="w-full sm:flex-1 px-6 sm:px-8 py-3.5 sm:py-4 border border-white/10 hover:border-white/20 hover:bg-white/[0.03] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl transition-all duration-200 text-center active:scale-[0.98]"
            >
              Read Docs
            </NextLink>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-5 h-8 rounded-full border-2 border-white/10 flex items-start justify-center p-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-white/30"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </motion.section>

      {/* ═══════════════════ LIVE COMPONENTS SHOWCASE ═══════════════════ */}
      <Section className="py-20 md:py-32 px-6 relative" id="showcase">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20 flex flex-col gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#F59E0B] font-clash">LIVE PREVIEW</span>
            <h2 className="text-3xl md:text-6xl font-black font-clash text-white leading-tight">
              See it breathing.
            </h2>
            <p className="text-base text-white/40 max-w-2xl mx-auto font-satoshi">
              These are real components from inside Kylrix. Not mockups. Not screenshots. Alive.
            </p>
          </div>

          {/* ── Note + Tasks Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Notes Panel */}
            <div className="rounded-[28px] bg-[#0B0A09] border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(245,158,11,0.1) 0%, transparent 70%)' }} />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                    <StickyNote size={18} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="font-clash font-bold text-base text-white">Notes</h3>
                    <span className="font-mono text-[9px] text-white/30 tracking-wider">ENCRYPTED WORKSPACE</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#10B981]/5 border border-[#10B981]/20">
                  <Lock size={10} className="text-[#10B981]" />
                  <span className="font-mono text-[8px] font-bold text-[#10B981]">E2E</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 relative z-10">
                {DUMMY_NOTES.map((note, i) => (
                  <LiveNoteCard key={note.id} note={note} index={i} />
                ))}
              </div>
            </div>

            {/* Tasks Panel */}
            <div className="rounded-[28px] bg-[#0B0A09] border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20">
                    <Zap size={18} className="text-[#10B981]" />
                  </div>
                  <div>
                    <h3 className="font-clash font-bold text-base text-white">Goals</h3>
                    <span className="font-mono text-[9px] text-white/30 tracking-wider">FLOW ENGINE</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#9B9691]">3 active</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 relative z-10">
                {DUMMY_TASKS.map((task, i) => (
                  <LiveTaskItem key={task.id} task={task} index={i} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Connect + Huddle Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Social Feed */}
            <div className="rounded-[28px] bg-[#0B0A09] border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(244,63,94,0.08) 0%, transparent 70%)' }} />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20">
                    <MessageSquare size={18} className="text-[#F43F5E]" />
                  </div>
                  <div>
                    <h3 className="font-clash font-bold text-base text-white">Connect</h3>
                    <span className="font-mono text-[9px] text-white/30 tracking-wider">SOCIAL FEED</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 relative z-10">
                {DUMMY_MOMENTS.map((moment, i) => (
                  <LiveMomentCard key={moment.id} moment={moment} index={i} />
                ))}
              </div>
            </div>

            {/* Live Huddle */}
            <div className="rounded-[28px] bg-[#0B0A09] border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(245,158,11,0.1) 0%, transparent 70%)' }} />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                    <Video size={18} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="font-clash font-bold text-base text-white">Huddles</h3>
                    <span className="font-mono text-[9px] text-white/30 tracking-wider">LIVE CALL</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#10B981]/5 border border-[#10B981]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="font-mono text-[8px] font-bold text-[#10B981]">LIVE</span>
                </div>
              </div>

              <div className="relative z-10">
                <LiveHuddlePanel />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════ VAULT SECTION ═══════════════════ */}
      <Section className="py-20 md:py-32 px-6 border-t border-white/[0.03]" id="vault">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-8">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#A855F7] font-clash block mb-3">VAULT</span>
              <h2 className="text-3xl md:text-5xl font-black font-clash text-white leading-tight mb-4">
                Secrets stay sealed.
              </h2>
              <p className="text-base text-white/40 leading-relaxed font-satoshi">
                Passwords, 2FA codes, and cryptographic keys — all protected behind your master passphrase. Zero-knowledge means we can never see your data. Even if we wanted to.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { icon: Lock, title: 'Master Passphrase', desc: 'Argon2id-stretched key derivation. Your passphrase never leaves your device.', color: '#A855F7' },
                { icon: Shield, title: 'Zero-Knowledge', desc: 'We store ciphertext only. Not even our infrastructure can read your secrets.', color: '#10B981' },
                { icon: Globe, title: 'Cross-Device Sync', desc: 'Encrypted blobs sync across all your devices. Decrypt only when you unlock.', color: '#F59E0B' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-4 items-start"
                >
                  <div className="pt-0.5" style={{ color: item.color }}><item.icon size={24} strokeWidth={1.5} /></div>
                  <div>
                    <h4 className="font-clash font-bold text-base text-white mb-1">{item.title}</h4>
                    <p className="text-sm text-white/35 leading-relaxed font-satoshi">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-[#0B0A09] border border-white/5 p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(168,85,247,0.12) 0%, transparent 70%)' }} />
            <div className="relative z-10">
              <LiveVaultPreview />
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════ ECOSYSTEM GRID ═══════════════════ */}
      <Section className="py-20 md:py-32 px-6 border-t border-white/[0.03]" id="ecosystem">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 flex flex-col gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#6366F1] font-clash">THE ECOSYSTEM</span>
            <h2 className="text-3xl md:text-6xl font-black font-clash text-white">
              Four apps. One session.
            </h2>
            <p className="text-base text-white/40 max-w-xl mx-auto font-satoshi">
              Every app shares one identity, one encryption layer, one design system. No fragmentation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {APPS.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className="group cursor-pointer"
              >
                <NextLink href={`/${app.id === 'connect' ? 'connect' : app.id}`} className="block h-full">
                  <div className="p-6 rounded-3xl border border-white/5 bg-[#161412] hover:bg-[#1C1917] transition-all duration-300 flex flex-col gap-5 h-full"
                    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${app.color}0d`, borderColor: `${app.color}1f` }}
                    >
                      <Logo app={app.id as any} size={32} variant="icon" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-black font-clash text-white mb-2">{app.label}</h4>
                      <p className="text-sm text-white/40 leading-relaxed font-satoshi">{app.desc}</p>
                    </div>
                    <div className="pt-3 mt-auto">
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider transition-colors" style={{ color: app.color }}>
                        <span>Open {app.label}</span>
                        <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </NextLink>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══════════════════ CTA BANNER ═══════════════════ */}
      <Section className="px-6 py-20 md:py-32" id="cta">
        <div className="max-w-5xl mx-auto">
          <div className="p-8 md:p-16 rounded-[36px] bg-[#161412] border border-white/5 relative overflow-hidden text-center"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            {/* Ambient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 60%)' }} />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <h3 className="text-3xl md:text-5xl font-black font-clash text-white leading-tight px-2">
                Ready to own your workflow?
              </h3>
              <p className="text-sm md:text-base text-white/40 max-w-xl font-satoshi px-4">
                Free forever. No credit card. No tracking. Just tools that respect you.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 w-full max-w-xs sm:max-w-md">
                <button
                  onClick={() => openIDMWindow()}
                  disabled={isAuthenticating}
                  className="w-full sm:flex-1 px-8 py-3.5 bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl transition-all duration-200 shadow-[0_0_40px_rgba(99,102,241,0.25)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Create Free Account
                </button>
                <NextLink
                  href="/pricing"
                  className="w-full sm:flex-1 px-8 py-3.5 border border-white/10 hover:border-white/20 hover:bg-white/[0.03] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl transition-all duration-200 text-center active:scale-[0.98]"
                >
                  View Pricing
                </NextLink>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-white/[0.03] py-12 bg-[#0A0908] px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-white/40 block font-clash">KYLRIX.SPACE</span>
            <p className="text-xs text-white/25 mt-1 max-w-md font-satoshi">
              One system, one session, one premium surface for the entire ecosystem.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <NextLink href="/docs" className="text-xs font-black text-white/60 hover:text-[#6366F1] transition font-clash uppercase tracking-wider">Docs</NextLink>
            <NextLink href="/downloads" className="text-xs font-black text-white/60 hover:text-[#6366F1] transition font-clash uppercase tracking-wider">Downloads</NextLink>
            <NextLink href="/pricing" className="text-xs font-black text-white/60 hover:text-[#6366F1] transition font-clash uppercase tracking-wider">Pricing</NextLink>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/[0.03] text-center">
          <span className="text-[10px] text-white/15 font-black tracking-widest uppercase font-clash block">
            © 2026 Kylrix Ecosystem. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
