'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlarmClock,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  Compass,
  Copy,
  ClipboardPaste,
  CreditCard,
  Download,
  FilePlus,
  Flag,
  FolderKanban,
  History,
  Kanban,
  KeyRound,
  Lightbulb,
  Link2,
  ListTodo,
  Lock,
  MessageSquare,
  MessagesSquare,
  MessageSquarePlus,
  Milestone,
  PenLine,
  Plus,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  MoreHorizontal,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sunrise,
  Tags,
  Target,
  TextSelect,
  Trash2,
  User,
  Users,
  Video,
  Wallet,
  Workflow,
  X,
  Zap} from 'lucide-react';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { parseChatAttachFile, type ChatPendingObject } from '@/lib/chat/pending-object';
import { ChatObjectPreview } from '@/components/chat/ChatObjectPreview';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useSudo } from '@/context/SudoContext';
import { isHardVerificationEnabled } from '@/components/settings/HardVerificationSettings';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useDataNexus } from '@/context/DataNexusContext';
import { AgenticService } from '@/lib/services/agentic';
import {
  buildInstantPrompt,
  getQuickWorkflows,
  resolveAgenticPageContext,
  runInstantAgenticRequest,
  type QuickWorkflowAction,
  userMayUsePaidAi,
  AI_UPGRADE_LABEL} from '@/lib/agentic';
import { getAgenticUserMessage } from '@/lib/agentic/errors';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { account } from '@/lib/appwrite/client';
import { WalletService } from '@/lib/services/wallets';
import { toast } from 'react-hot-toast';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { useHintEngine } from '@/hooks/useHintEngine';
import { AgenticMessageBody } from '@/components/agentic/AgenticMessageBody';
import { AgenticMessageActions } from '@/components/agentic/AgenticMessageActions';
import {
  parseBlocksFromToolSummary,
  type AgenticMessageBlock} from '@/lib/agentic/message-blocks';
import {
import { loadSessionHistory as loadSessionHistory_ext } from './AgenticPanelContentSections/loadSessionHistory';
import { handleSelectSession as handleSelectSession_ext } from './AgenticPanelContentSections/handleSelectSession';
import { handleStartNewSession as handleStartNewSession_ext } from './AgenticPanelContentSections/handleStartNewSession';
import { formatHistoryMessages as formatHistoryMessages_ext } from './AgenticPanelContentSections/formatHistoryMessages';
import { handleApprovePayment as handleApprovePayment_ext } from './AgenticPanelContentSections/handleApprovePayment';
import { handleShareSession as handleShareSession_ext } from './AgenticPanelContentSections/handleShareSession';
import { recordToolCall as recordToolCall_ext } from './AgenticPanelContentSections/recordToolCall';
import { handleOpenSessions as handleOpenSessions_ext } from './AgenticPanelContentSections/handleOpenSessions';
import { AgenticPanelContentView } from './AgenticPanelContentSections/AgenticPanelContentView';
import { handleDeleteSession as handleDeleteSession_ext } from './AgenticPanelContentSections/handleDeleteSession';
import { handleToggleSessionPinned as handleToggleSessionPinned_ext } from './AgenticPanelContentSections/handleToggleSessionPinned';
import { recordSessionObject as recordSessionObject_ext } from './AgenticPanelContentSections/recordSessionObject';
import { handleInputChange as handleInputChange_ext } from './AgenticPanelContentSections/handleInputChange';
  AgenticSessionLocalStore,
  subscribeAgenticLocalStore,
  type AgenticSyncStatus} from '@/lib/agentic/session-local-store';
interface ToolCallDisplay {
  toolKey: string;
  specifier?: string | null;
  status?: string | null;
  resultSummary?: string | null;
  args?: string | null;
}
interface NextStepSuggestion {
  label: string;
  prompt: string;
}
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: AgenticMessageBlock[];
  syncStatus?: AgenticSyncStatus;
  isPublic?: boolean;
  isGuest?: boolean;
  tools?: ToolCallDisplay[];
  nextSteps?: NextStepSuggestion[];
}
/** Strip behind-the-hood prompt templates so the UI shows the user's exact words. */
function visibleChatContent(role: string, content: unknown): string {
  const raw = typeof content === 'string' ? content : '';
  if (role !== 'user') return raw;
  if (/User request:\s*/i.test(raw)) {
    const match = raw.match(/User request:\s*([\s\S]*)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return raw.trim();
}
function normalizeNextSteps(raw: unknown): NextStepSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      label: String(item?.label || '').trim(),
      prompt: String(item?.prompt || '').trim()}))
    .filter((s) => s.label && s.prompt)
    .slice(0, 4);
}
const formatHistoryMessages = (..._args: any[]) => formatHistoryMessages_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
const QUICK_ICON_MAP: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'pen-line': PenLine,
  sparkles: Sparkles,
  'list-todo': ListTodo,
  'share-2': Share2,
  'calendar-range': CalendarRange,
  'calendar-plus': CalendarPlus,
  calendar: Calendar,
  'alarm-clock': AlarmClock,
  target: Target,
  zap: Zap,
  flag: Flag,
  kanban: Kanban,
  'shield-check': ShieldCheck,
  'key-round': KeyRound,
  tags: Tags,
  lock: Lock,
  smartphone: Smartphone,
  'message-square': MessageSquare,
  messages: MessagesSquare,
  users: Users,
  video: Video,
  'bar-chart-3': BarChart3,
  send: Send,
  'link-2': Link2,
  'folder-kanban': FolderKanban,
  bell: Bell,
  shield: Shield,
  bot: Bot,
  compass: Compass,
  'refresh-cw': RefreshCw,
  settings: Settings,
  'credit-card': CreditCard,
  user: User,
  sunrise: Sunrise,
  lightbulb: Lightbulb,
  workflow: Workflow,
  'file-plus': FilePlus,
  search: Search,
  milestone: Milestone,
  wallet: Wallet};
function zoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    note: 'Ideas',
    flow: 'Flow',
    vault: 'Vault',
    connect: 'Connect',
    projects: 'Projects',
    settings: 'Settings',
    agents: 'Kylie',
    accounts: 'Accounts'};
  return labels[zone] || 'Workspace';
}
interface AgenticPanelContentProps {
  onClose: () => void;
  isDesktop: boolean;
}
export function AgenticPanelContent({ onClose, isDesktop }: AgenticPanelContentProps) {
  const { consumePendingPrompt } = useAgenticDrawer();
  const { open: openUnified } = useUnifiedDrawer();
  const { openWalletWithIntent } = useWalletOverlay();
  const { promptSudo, isUnlocked: isVaultUnlocked } = useSudo();
  const { user } = useAuth();
  const { notes: allNotes, pushLiveNote, registerComposeSession, unregisterComposeSession, migrateDraftNoteId, removeNote } = useNotes();
  const { setCachedData } = useDataNexus();
  const { addTask, updateTask, deleteTask, tasks } = useTask();
  const { activeWorkspace, attachEntityToActiveWorkspace, setActiveWorkspaceId } = useWorkspace();
  const { openOverlay } = useOverlay();
  const { openSidebar } = useDynamicSidebar();
  const { openProUpgrade } = useProUpgrade();
  const { openFileDrawer } = useUnifiedFileDrawer();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isPro = userMayUsePaidAi(user);
  const pageContext = useMemo(() => resolveAgenticPageContext(pathname), [pathname]);
  const accent = useMemo(() => getAppColor(pageContext.accentApp), [pageContext.accentApp]);
  const workflows = useMemo(() => getQuickWorkflows(pageContext), [pageContext]);
  const [chatInput, setChatInput] = useState('');
  const [pendingObject, setPendingObject] = useState<ChatPendingObject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const composerHints = useHintEngine({
    zone: 'agentic.composer',
    route: pathname,
    input: chatInput,
    enabled: !executing && chatInput.trim().length >= 2});
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [pendingPayment, setPendingPayment] = useState<{ agentId: string; amount: number; intentId: string; chainId: number; phase?: 'review' | 'processing' | 'done' } | null>(null);
  const [signing, setSigning] = useState(false);
  const [pendingToolAuth, setPendingToolAuth] = useState<{ toolKey: string; name: string; specifier?: string; args?: any; assistantId?: string } | null>(null);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const { filteredItems: workspaceFilteredSessions } = useWorkspaceFilteredItems(sessions, 'agent_session');
  const isWorkspaceReadOnly = Boolean(
    activeWorkspace &&
      !activeWorkspace.isPersonal &&
      activeWorkspace.isShared &&
      activeWorkspace.role !== 'owner' &&
      activeWorkspace.role !== 'editor' &&
      activeWorkspace.role !== 'admin'
  );
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    const wsId = activeWorkspace.id;
    let cancelled = false;
    void (async () => {
      try {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
        if (tagged?.sessions && Array.isArray(tagged.sessions) && tagged.sessions.length > 0 && !cancelled) {
          setSessions((prev) => {
            const byId = new Map(prev.map((s) => [s.$id || s.id, s]));
            tagged.sessions.forEach((s: any) => {
              const id = s.$id || s.id;
              if (id) byId.set(id, { ...byId.get(id), ...s, id, $id: id, projectId: wsId, isWorkspace: true });
            });
            return Array.from(byId.values());
          });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionActionsDrawer, setShowSessionActionsDrawer] = useState(false);
  const [selectedSessionActionTarget, setSelectedSessionActionTarget] = useState<any | null>(null);
  const [messageMenuTarget, setMessageMenuTarget] = useState<ChatMessage | null>(null);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const syncTimeoutRef = useRef<any>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const handleInputChange = (..._args: any[]) => handleInputChange_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordSessionObject, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, touchStartPosRef, workflows });
  useEffect(() => {
    const handlePaymentRequest = (e: CustomEvent) => {
      const { agentId, amount, intentId, chainId } = e.detail;
      setPendingPayment({ agentId, amount, intentId, chainId, phase: 'review' });
    };
    window.addEventListener('kylrix:request-payment' as any, handlePaymentRequest);
    return () => window.removeEventListener('kylrix:request-payment' as any, handlePaymentRequest);
  }, []);
  const handleApprovePayment = (..._args: any[]) => handleApprovePayment_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
  const handleStartNewSession = (..._args: any[]) => handleStartNewSession_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
  const handleCreateNewSessionFromDrawer = async () => {
    await handleStartNewSession();
    setShowSessionsDrawer(false);
  };
  const handleOpenSessions = (..._args: any[]) => handleOpenSessions_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
  const handleSelectSession = (..._args: any[]) => handleSelectSession_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
  const handleDeleteSession = (..._args: any[]) => handleDeleteSession_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordSessionObject, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, touchStartPosRef, workflows });
  const handleShareSession = (..._args: any[]) => handleShareSession_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
  const handleToggleSessionPinned = (..._args: any[]) => handleToggleSessionPinned_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordSessionObject, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, touchStartPosRef, workflows });
  const openSessionActionsDrawer = useCallback((sess: any) => {
    setSelectedSessionActionTarget(sess);
    setShowSessionActionsDrawer(true);
  }, []);
  const clearSessionLongPress = useCallback(() => {
    if (sessionLongPressTimerRef.current) {
      clearTimeout(sessionLongPressTimerRef.current);
      sessionLongPressTimerRef.current = null;
    }
  }, []);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!user?.$id) {
      setAgentCount(0);
      return;
    }
    void AgenticService.listMyAgents(user.$id)
      .then((rows) => setAgentCount(rows.length))
      .catch(() => setAgentCount(0));
    const loadSessionHistory = (..._args: any[]) => loadSessionHistory_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
    void loadSessionHistory();
  }, [user?.$id]);
  useEffect(() => {
    if (!showSessionsDrawer || !user?.$id) return;
    return subscribeAgenticLocalStore(() => {
      void AgenticSessionLocalStore.getSessionsList(user.$id).then((rows) => setSessions(rows));
    });
  }, [showSessionsDrawer, user?.$id]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
        LocalEngine.cacheGet<string>('kylrix_kylie_live_input').then((localDraft) => {
          if (localDraft) setChatInput(localDraft);
        });
      });
    }
  }, []);
  useEffect(() => {
    const fetchRemoteDraft = async () => {
      try {
        const appPrefs = await account.getPrefs();
        const remoteDraft = appPrefs?.kylie_live_input || '';
        if (remoteDraft && remoteDraft !== localStorage.getItem('kylrix_kylie_live_input')) {
          setChatInput(remoteDraft);
          localStorage.setItem('kylrix_kylie_live_input', remoteDraft);
        }
      } catch {}
    };
    if (user?.$id) void fetchRemoteDraft();
  }, [user?.$id]);
  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, executing]);
  const appendMessage = useCallback((
    role: ChatMessage['role'],
    content: string,
    opts?: {
      blocks?: AgenticMessageBlock[];
      id?: string;
      syncStatus?: AgenticSyncStatus;
      isPublic?: boolean;
      isGuest?: boolean;
    }) => {
    setMessages((prev) => [
      ...prev,
      {
        id: opts?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content,
        blocks: opts?.blocks,
        syncStatus: opts?.syncStatus,
        isPublic: opts?.isPublic,
        isGuest: opts?.isGuest},
    ]);
  }, []);
  const runPrompt = useCallback(
    async (rawPrompt: string) => {
      const trimmed = rawPrompt.trim();
      if (!trimmed) return;
      if (!isPro) {
        openProUpgrade(AI_UPGRADE_LABEL);
        return;
      }
      const promptWithAttachment = pendingObject
        ? `${trimmed}\n\n[Attached: ${pendingObject.payload.label || 'Object'} (${pendingObject.payload.childKind || 'item'}) - ID: ${pendingObject.payload.childId}]`
        : trimmed;
      const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      appendMessage('user', promptWithAttachment, { syncStatus: 'pending', id: userMsgId });
      const draftSessionId = activeSessionId || `session_${Date.now()}`;
      if (user?.$id) {
        void AgenticSessionLocalStore.appendMessages(user.$id, draftSessionId, [
          { id: userMsgId, role: 'user', content: promptWithAttachment, syncStatus: 'pending' },
        ]);
        void AgenticSessionLocalStore.setActiveSessionId(user.$id, draftSessionId);
        if (!activeSessionId) setActiveSessionId(draftSessionId);
      }
      setChatInput('');
      setPendingObject(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix_kylie_live_input');
      }
      account.getPrefs().then((currentPrefs: any) => {
        account.updatePrefs({ ...currentPrefs, kylie_live_input: '' }).catch(() => {});
      }).catch(() => {});
      setExecuting(true);
      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const contextualPrompt = buildInstantPrompt(trimmed, pageContext);
        const res = await runInstantAgenticRequest({
          prompt: contextualPrompt,
          user,
          jwt,
          pageContext: {
            zone: pageContext.zone,
            route: pageContext.route,
            title: pageContext.title,
            systemHint: pageContext.systemHint,
            resourceId: pageContext.resourceId,
            userMessage: trimmed},
          userMessage: trimmed});
        if (res.success) {
          if (res.sessionId) {
            setActiveSessionId(res.sessionId);
            if (user?.$id) {
              void AgenticSessionLocalStore.setActiveSessionId(user.$id, res.sessionId);
              void import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
                void LocalEngine.cacheSet(`f_agent_active_session_${user.$id}`, res.sessionId).catch(() => {});
              });
              void account.getPrefs().then((p: any) => account.updatePrefs({ ...p, activeAgentSessionId: res.sessionId }).catch(() => {})).catch(() => {});
            }
          }
          const assistantId = res.conversationId || `${Date.now()}-a`;
          const executedTools: ToolCallDisplay[] = [];
          const sessionIdForObjects = res.sessionId as string | undefined;
          const conversationId = res.conversationId as string | undefined;
          const recordToolCall = (..._args: any[]) => recordToolCall_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, formatHistoryMessages, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordToolCall, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, toolsByConversation, touchStartPosRef, workflows });
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: res.response,
              syncStatus: 'pending',
              tools: [],
              nextSteps: normalizeNextSteps(res.nextSteps)},
          ]);
          let liveNextSteps = normalizeNextSteps(res.nextSteps);
          if (Array.isArray(res.toolCalls) && res.toolCalls.length > 0) {
            for (const call of res.toolCalls) {
              const { AGENTIC_TOOLS_REGISTRY } = await import('@/lib/agentic/tools-registry');
              const toolDef = AGENTIC_TOOLS_REGISTRY.find(t => t.key === call.toolKey);
              if (toolDef) {
                if (call.toolKey === 'suggest_next_steps') {
                  const steps = normalizeNextSteps(call.args?.suggestions);
                  if (steps.length) {
                    liveNextSteps = steps;
                    setMessages((prev) =>
                      prev.map((m) => (m.id === assistantId ? { ...m, nextSteps: steps } : m)));
                  }
                  await recordToolCall(call, 'success', `${steps.length} next steps`);
                  continue;
                }
                if (toolDef.requiresAuthorization) {
                  let isPreAuthorized = false;
                  const hardVerification = isHardVerificationEnabled();
                  if (!hardVerification && isVaultUnlocked) {
                    isPreAuthorized = true;
                  } else {
                    try {
                      const appPrefs = await account.getPrefs();
                      const { parseAgenticPreferences, toolRequiresAuthorization } = await import('@/lib/agentic/preferences');
                      const agentPrefs = parseAgenticPreferences(appPrefs as Record<string, unknown>);
                      isPreAuthorized = !toolRequiresAuthorization(call.toolKey, agentPrefs, toolDef.requiresAuthorization);
                    } catch {}
                  }
                  if (!isPreAuthorized) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              blocks: [
                                ...(m.blocks || []),
                                {
                                  type: 'pending_auth',
                                  toolKey: call.toolKey,
                                  name: toolDef.name,
                                  status: 'pending',
                                  specifier: call.specifier,
                                },
                              ],
                            }
                          : m
                      )
                    );
                    setPendingToolAuth({
                      toolKey: call.toolKey,
                      name: toolDef.name,
                      specifier: call.specifier,
                      args: call.args,
                      assistantId,
                    });
                    break;
                  }
                }
                if (call.toolKey === 'wallet_send_tokens') {
                  const unlocked = await promptSudo('unlock', false, false);
                  if (!unlocked) {
                    toast.error('Transaction cancelled: MasterPass verification required');
                    await recordToolCall(call, 'error', 'MasterPass verification cancelled');
                    continue;
                  }
                }
                try {
                  const recordSessionObject = (..._args: any[]) => recordSessionObject_ext({ accent, activeSessionId, agentCount, appendMessage, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, executing, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, isPro, isWorkspaceReadOnly, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, pendingObject, pendingPayment, pendingToolAuth, raw, recordSessionObject, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, signing, syncTimeoutRef, textareaRef, touchStartPosRef, workflows });
                  const { executeAgenticToolCallWithToast } = await import('@/lib/agentic/client-executor');
                  const result = await executeAgenticToolCallWithToast(
                    call,
                    {
                      user,
                      router,
                      onClose,
                      setActiveWorkspaceId,
                      openDetailOverlay: (kind: string, id: string) => {
                        const targetNote = allNotes.find((n: any) => n.$id === id);
                        const NoteDetailSidebar = require('@/components/ui/NoteDetailSidebar').default;
                        if (targetNote && NoteDetailSidebar) {
                          if (isDesktop) {
                            openSidebar(<NoteDetailSidebar note={targetNote} onClose={() => {}} />, id, { fullscreen: true });
                          } else {
                            openOverlay(<NoteDetailSidebar note={targetNote} onClose={() => {}} />);
                          }
                        }
                      },
                      tasks,
                      notes: allNotes,
                      setCachedData,
                      pushLiveNote,
                      removeNote,
                      registerComposeSession,
                      unregisterComposeSession,
                      migrateDraftNoteId,
                      addTask,
                      updateTask: async (id: string, patch: any) => {
                        updateTask(id, patch);
                      },
                      deleteTask: async (id: string) => {
                        deleteTask(id);
                      },
                      appendMessage,
                      openDrawer: (type: string, payload?: Record<string, unknown>) => {
                        openUnified(type as any, payload);
                      },
                      openWalletWithIntent,
                      recordSessionObject},
                    toolDef.name);
                  if (!result.success) {
                    await recordToolCall(call, 'error', result.error || 'Failed');
                    continue;
                  }
                  if (result.messageBlocks?.length) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, blocks: [...(m.blocks || []), ...result.messageBlocks!] }
                          : m));
                  }
                  await recordToolCall(call, 'success', result.summary);
                } catch (err: any) {
                  console.error(`Failed to execute tool ${call.toolKey}:`, err);
                  await recordToolCall(call, 'error', err?.message || 'Failed');
                  toast.error(`Kylie couldn't run ${toolDef.name}`);
                }
              }
            }
            if (executedTools.length > 0 || liveNextSteps.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        tools: executedTools.length ? executedTools : m.tools,
                        nextSteps: liveNextSteps.length ? liveNextSteps : m.nextSteps}
                    : m));
            }
            const sid = (res.sessionId as string) || activeSessionId;
            if (sid && user?.$id) {
              setMessages((prev) => {
                const synced = prev.map((m) => ({
                  ...m,
                  syncStatus: (m.syncStatus === 'pending' ? 'synced' : m.syncStatus) as AgenticSyncStatus}));
                void AgenticSessionLocalStore.setActiveMessages(
                  user.$id,
                  sid,
                  synced.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    blocks: m.blocks,
                    syncStatus: m.syncStatus,
                    isPublic: m.isPublic,
                    isGuest: m.isGuest,
                    nextSteps: m.nextSteps})));
                return synced;
              });
            }
          }
        } else {
          appendMessage('assistant', res.response || 'Something went wrong. Please try again later.');
        }
      } catch (err: unknown) {
        appendMessage('assistant', getAgenticUserMessage(err));
      } finally {
        setExecuting(false);
        setRunningWorkflowId(null);
      }
    },
    [appendMessage, isPro, openProUpgrade, pageContext, addTask, updateTask, deleteTask, pushLiveNote, registerComposeSession, unregisterComposeSession, migrateDraftNoteId, removeNote, user, onClose, router, openUnified, setCachedData, tasks, allNotes, activeSessionId, pendingObject]);
  useEffect(() => {
    const pending = consumePendingPrompt();
    if (pending?.prompt) {
      setChatInput(pending.prompt);
      if (pending.autoRun) void runPrompt(pending.prompt);
      else textareaRef.current?.focus();
    }
  }, [consumePendingPrompt, runPrompt]);
  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (isWorkspaceReadOnly) {
        toast.error('Cannot send messages in view-only shared workspace.');
        return;
      }
      void runPrompt(chatInput);
    },
    [chatInput, runPrompt, isWorkspaceReadOnly]);
  const handleWorkflow = useCallback(
    async (action: QuickWorkflowAction) => {
      if (action.kind === 'navigate' && action.href) {
        onClose();
        router.push(action.href);
        return;
      }
      const prompt = action.prompt || '';
      if (action.kind === 'prompt') {
        setChatInput(prompt);
        textareaRef.current?.focus();
        return;
      }
      if (!prompt) return;
      setChatInput(prompt);
      if (action.autoRun) {
        setRunningWorkflowId(action.id);
        await runPrompt(prompt);
      }
    },
    [onClose, router, runPrompt]);
  const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  const openMessageMenu = useCallback((msg: ChatMessage) => {
    setComposerMenuOpen(false);
    setMessageMenuTarget(msg);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  }, []);
  const openComposerMenu = useCallback(() => {
    setMessageMenuTarget(null);
    setComposerMenuOpen(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  }, []);
  const handleMessageTouchStart = useCallback(
    (e: React.TouchEvent, msg: ChatMessage) => {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => openMessageMenu(msg), 500);
    },
    [openMessageMenu]);
  const handleMessageTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      touchStartPosRef.current = null;
    }
  }, []);
  const handleMessageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (composerLongPressTimerRef.current) clearTimeout(composerLongPressTimerRef.current);
    };
  }, []);
  const handleComposerTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      if (composerLongPressTimerRef.current) clearTimeout(composerLongPressTimerRef.current);
      composerLongPressTimerRef.current = setTimeout(() => openComposerMenu(), 500);
    },
    [openComposerMenu]);
  const handleComposerTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10 && composerLongPressTimerRef.current) {
      clearTimeout(composerLongPressTimerRef.current);
      composerLongPressTimerRef.current = null;
      touchStartPosRef.current = null;
    }
  }, []);
  const handleComposerTouchEnd = useCallback(() => {
    if (composerLongPressTimerRef.current) {
      clearTimeout(composerLongPressTimerRef.current);
      composerLongPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);
  const handleComposerPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setComposerMenuOpen(false);
        return;
      }
      const el = textareaRef.current;
      if (el) {
        const start = el.selectionStart ?? chatInput.length;
        const end = el.selectionEnd ?? chatInput.length;
        const next = `${chatInput.slice(0, start)}${text}${chatInput.slice(end)}`;
        handleInputChange(next);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + text.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        handleInputChange(chatInput + text);
      }
      setComposerMenuOpen(false);
    } catch {
      toast.error('Could not paste from clipboard');
      setComposerMenuOpen(false);
    }
  }, [chatInput, handleInputChange]);
  const handleComposerSelectAll = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !chatInput) return;
    el.focus();
    el.select();
    setComposerMenuOpen(false);
  }, [chatInput]);
  const handleComposerCopyAll = useCallback(() => {
    if (!chatInput) return;
    void navigator.clipboard.writeText(chatInput);
    toast.success('Copied to clipboard');
    setComposerMenuOpen(false);
  }, [chatInput]);
  const handleComposerClear = useCallback(() => {
    handleInputChange('');
    setComposerMenuOpen(false);
    textareaRef.current?.focus();
  }, [handleInputChange]);
  const handleCopyMessage = useCallback((content: string) => {
    void navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
    setMessageMenuTarget(null);
  }, []);
  const handleRetryMessage = useCallback(
    async (msg: ChatMessage) => {
      setMessageMenuTarget(null);
      const idx = messages.findIndex((m) => m.id === msg.id);
      if (idx < 0) return;
      let promptText = '';
      let truncateTo = idx;
      if (msg.role === 'user') {
        promptText = msg.content;
      } else {
        let userIdx = -1;
        for (let i = idx - 1; i >= 0; i -= 1) {
          if (messages[i].role === 'user') {
            userIdx = i;
            break;
          }
        }
        if (userIdx < 0) {
          toast.error('No prompt found to retry.');
          return;
        }
        promptText = messages[userIdx].content;
        truncateTo = userIdx;
      }
      if (!promptText.trim()) return;
      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const { flagAgentConversationPointAction } = await import('@/lib/actions/agentic');
        await flagAgentConversationPointAction(
          {
            conversationId: msg.id,
            messageRole: msg.role,
            sessionId: activeSessionId || undefined,
            reason: 'user_retry'},
          jwt);
      } catch (err) {
        console.warn('[agentic] Failed to flag conversation point:', err);
      }
      setMessages((prev) => prev.slice(0, truncateTo));
      await runPrompt(promptText);
    },
    [activeSessionId, messages, runPrompt]);
  const handleStartConversationFromPrompt = useCallback(
    async (msg: ChatMessage, carryContext: boolean) => {
      setMessageMenuTarget(null);
      const starter = msg.content?.trim();
      if (!starter) return;
      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const { startNewAgentSessionFromPromptAction } = await import('@/lib/actions/agentic');
        const res = await startNewAgentSessionFromPromptAction(
          {
            starterPrompt: starter,
            carryContext,
            sourceSessionId: activeSessionId || undefined},
          jwt);
        if (!res.success) {
          toast.error('Could not start a new conversation.');
          return;
        }
        setActiveSessionId(res.sessionId || null);
        setMessages([]);
        if (typeof window !== 'undefined' && user?.$id) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          void LocalEngine.cacheSet(`kylrix_agentic_chat_history_${user.$id}`, []);
        }
        toast.success(
          carryContext
            ? 'New conversation started with compressed context.'
            : 'New conversation started.');
        await runPrompt(starter);
      } catch (err) {
        console.error('[agentic] Failed to fork conversation:', err);
        toast.error('Could not start a new conversation.');
      }
    },
    [activeSessionId, runPrompt, user?.$id]);
  const messageMenuItems = useMemo(() => {
    if (!messageMenuTarget) return [];
    if (messageMenuTarget.role === 'user') {
      return [
        {
          label: 'Copy prompt',
          icon: <Copy size={16} />,
          onClick: () => handleCopyMessage(messageMenuTarget.content)},
        {
          label: 'Retry',
          icon: <RefreshCw size={16} />,
          onClick: () => void handleRetryMessage(messageMenuTarget)},
        {
          label: 'Start new conversation',
          icon: <MessageSquarePlus size={16} />,
          onClick: () => void handleStartConversationFromPrompt(messageMenuTarget, false)},
        {
          label: 'Start new conversation with context',
          icon: <History size={16} />,
          onClick: () => void handleStartConversationFromPrompt(messageMenuTarget, true)},
      ];
    }
    return [
      {
        label: 'Copy response',
        icon: <Copy size={16} />,
        onClick: () => handleCopyMessage(messageMenuTarget.content)},
    ];
  }, [
    messageMenuTarget,
    handleCopyMessage,
    handleRetryMessage,
    handleStartConversationFromPrompt,
  ]);
  const composerMenuItems = useMemo(() => {
    const hasText = Boolean(chatInput);
    const items: Array<{
      label: string;
      icon: ReactNode;
      onClick: () => void;
      variant?: 'default' | 'destructive';
    }> = [
      {
        label: 'Paste',
        icon: <ClipboardPaste size={16} />,
        onClick: () => {
          void handleComposerPaste();
        }},
    ];
    if (hasText) {
      items.push(
        {
          label: 'Select all',
          icon: <TextSelect size={16} />,
          onClick: () => {
            handleComposerSelectAll();
          }},
        {
          label: 'Copy all',
          icon: <Copy size={16} />,
          onClick: () => {
            handleComposerCopyAll();
          }},
        {
          label: 'Clear',
          icon: <Trash2 size={16} />,
          onClick: () => {
            handleComposerClear();
          },
          variant: 'destructive'});
    }
    return items;
  }, [
    chatInput,
    handleComposerPaste,
    handleComposerSelectAll,
    handleComposerCopyAll,
    handleComposerClear,
  ]);
  const handleExportSession = useCallback(() => {
    if (!messages.length) {
      toast.error('No conversation messages to export');
      return;
    }
    try {
      const payload = {
        sessionId: activeSessionId || 'current-session',
        exportedAt: new Date().toISOString(),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          blocks: m.blocks,
          timestamp: (m as any).timestamp || Date.now(),
        })),
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kylie-session-${activeSessionId || 'export'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Conversation exported as JSON');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export conversation');
    }
  }, [messages, activeSessionId]);
  return <AgenticPanelContentView {...({ NoteDetailSidebar, a, accent, activeSessionId, agentCount, agentPrefs, appPrefs, appendMessage, assistantId, blob, byId, cancelled, chatInput, chatScrollRef, clearSessionLongPress, composerHints, composerLongPressTimerRef, composerMenuItems, composerMenuOpen, contextualPrompt, conversationId, currentPrefs, draftSessionId, dx, dy, el, end, executing, fetchRemoteDraft, handleApprovePayment, handleComposerClear, handleComposerCopyAll, handleComposerKeyDown, handleComposerPaste, handleComposerSelectAll, handleComposerTouchEnd, handleComposerTouchMove, handleComposerTouchStart, handleCopyMessage, handleCreateNewSessionFromDrawer, handleDeleteSession, handleExportSession, handleInputChange, handleMessageTouchEnd, handleMessageTouchMove, handleMessageTouchStart, handleOpenSessions, handlePaymentRequest, handleRetryMessage, handleSelectSession, handleShareSession, handleStartConversationFromPrompt, handleStartNewSession, handleSubmit, handleToggleSessionPinned, handleWorkflow, hardVerification, hasText, id, idx, isDesktop, isPreAuthorized, isPro, isWorkspaceReadOnly, jsonStr, jwt, liveNextSteps, loadSessionHistory, loadingSessions, longPressTimerRef, messageMenuItems, messageMenuTarget, messages, next, nextSessions, node, onClose, openComposerMenu, openMessageMenu, openSessionActionsDrawer, pageContext, pathname, payload, pending, pendingObject, pendingPayment, pendingToolAuth, pinDelta, pos, prompt, promptText, promptWithAttachment, recordSessionObject, recordToolCall, remoteDraft, res, result, router, runPrompt, runningWorkflowId, selectedSessionActionTarget, sessionIdForObjects, sessionLongPressTimerRef, sessions, setActiveSessionId, setAgentCount, setChatInput, setComposerMenuOpen, setExecuting, setLoadingSessions, setMessageMenuTarget, setMessages, setPendingObject, setPendingPayment, setPendingToolAuth, setRunningWorkflowId, setSelectedSessionActionTarget, setSessions, setShowSessionActionsDrawer, setShowSessionsDrawer, setSigning, showSessionActionsDrawer, showSessionsDrawer, sid, signing, start, starter, steps, syncTimeoutRef, synced, tagged, targetNote, text, textareaRef, toolDef, touch, touchStartPosRef, trimmed, truncateTo, unlocked, url, userIdx, userMsgId, workflows, wsId })} />;
}
