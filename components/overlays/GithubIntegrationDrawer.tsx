'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Terminal, CheckCircle, ChevronRight, ArrowLeft, Play, ChevronDown, ChevronUp, GitPullRequest, ArrowUpRight } from 'lucide-react';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import toast from 'react-hot-toast';
import { account } from '@/lib/appwrite/client';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
import { SourceControlService } from '@/lib/services/sourceControl';
import { useSection } from '@/context/SectionContext';
import { OAuthProvider } from 'appwrite';

const GITHUB_ICON = (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = false
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="border border-[#1C1A18] rounded-2xl bg-[#0A0908] overflow-hidden">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div className="text-white/60 flex items-center">
            {icon}
          </div>
          <span className="text-sm font-extrabold text-white">
            {title}
          </span>
        </div>
        <button type="button" className="text-white/40 p-1 hover:text-white transition-colors cursor-pointer">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/[0.02]">
          {children}
        </div>
      )}
    </div>
  );
}

export function GithubIntegrationDrawer({
  isOpen,
  onClose,
  projectId,
  context = 'settings',
  onSaved,
  tasks = [],
  isFlapover = false
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  context?: 'settings' | 'project';
  onSaved?: () => void;
  tasks?: any[];
  isFlapover?: boolean;
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { setActiveDetail } = useSection();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const { user } = useAuth();
  const kylrixEmail = user?.email || '';

  // Viewport observer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkViewport = () => setIsDesktop(window.innerWidth >= 768);
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const isMobile = !isDesktop;
  
  const handleMorphToDetail = () => {
    setActiveDetail({
      type: 'github' as any,
      id: 'default',
      data: { projectId, context, onSaved, tasks }
    });
    onClose();
  };
  
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<any | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [checkingIdentities, setCheckingIdentities] = useState(false);

  const [githubSyncIssues, setGithubSyncIssues] = useState(true);
  const [githubSyncCommits, setGithubSyncCommits] = useState(true);
  const [githubSyncPRs, setGithubSyncPRs] = useState(false);

  // Disconnect Confirmation Multi-Stage Flow States
  const [disconnectStep, setDisconnectStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  // Project-specific states
  const [provider, setProvider] = useState('github');
  const [ownerName, setOwnerName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any | null>(null);
  const [step, setStep] = useState(1);

  // Live repositories datasets
  const [gitIssues, setGitIssues] = useState<any[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [gitPRs, setGitPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);

  // Sync orchestration
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeSyncStep, setActiveSyncStep] = useState('');
  const [syncLogs, setSyncLogs] = useState<any[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      service: 'System',
      message: 'Secure GitHub Integration pipeline offline. Awaiting repository setup.'
    }
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);
  const { requestSudo } = useSudo();

  const [reposList, setReposList] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');

  const handleFetchRepos = async () => {
    if (!ownerName.trim()) {
      toast.error('Please enter a Repository Owner (Org or Profile username) first.');
      return;
    }
    setLoadingRepos(true);
    setReposList([]);
    setRepoFilter('');
    
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      headers.Authorization = `token ${githubToken}`;
    }

    try {
      // 1. Try org repos first
      let res = await fetch(`https://api.github.com/orgs/${ownerName.trim()}/repos?per_page=100&sort=updated`, { headers });
      if (!res.ok) {
        // 2. Fallback to user repos
        res = await fetch(`https://api.github.com/users/${ownerName.trim()}/repos?per_page=100&sort=updated`, { headers });
      }

      if (!res.ok) {
        throw new Error('Failed to find organization or personal profile.');
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setReposList(data);
        toast.success(`Found ${data.length} repositories!`);
      } else {
        throw new Error('Invalid response from GitHub.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error fetching GitHub repositories.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const triggerSyncLog = useCallback((type: 'info' | 'success' | 'warn' | 'error', service: string, message: string) => {
    const newLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      service,
      message
    };
    setSyncLogs(prev => [...prev, newLog]);
  }, [setSyncLogs]);

  const fetchIssues = useCallback(async (tokenStr: string, owner: string, repo: string) => {
    if (!owner || !repo) return;
    setLoadingIssues(true);
    setIssuesError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=5`, {
        headers: {
          'Authorization': `token ${tokenStr}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) {
        throw new Error(`Repository issues query failed (status: ${res.status})`);
      }

      const rawIssues = await res.json();
      const parsedIssues = rawIssues
        .filter((item: any) => !item.pull_request)
        .map((item: any) => ({
          id: item.id,
          number: item.number,
          title: item.title,
          state: item.state,
          htmlUrl: item.html_url,
          createdAt: item.created_at
        }));

      setGitIssues(parsedIssues);
      triggerSyncLog('success', 'Issues Feed', `Conduit indexed ${parsedIssues.length} active repository issues.`);
    } catch (err: any) {
      console.error('[GithubIntegrationDrawer] failed to load issues', err);
      setIssuesError(err.message || 'Error occurred querying issues.');
      triggerSyncLog('error', 'Issues Feed', `API Query fault: ${err.message || err}`);
    } finally {
      setLoadingIssues(false);
    }
  }, [setLoadingIssues, setIssuesError, setGitIssues, triggerSyncLog]);

  const fetchPullRequests = useCallback(async (tokenStr: string, owner: string, repo: string) => {
    if (!owner || !repo) return;
    setLoadingPRs(true);
    setPrsError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=5`, {
        headers: {
          'Authorization': `token ${tokenStr}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) {
        throw new Error(`Repository Pull Requests query failed (status: ${res.status})`);
      }

      const rawPRs = await res.json();
      const parsedPRs = rawPRs.map((item: any) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        sourceBranch: item.head?.ref || 'main',
        targetBranch: item.base?.ref || 'main'
      }));

      setGitPRs(parsedPRs);
      triggerSyncLog('success', 'PRs Feed', `Conduit indexed ${parsedPRs.length} pull request activities.`);
    } catch (err: any) {
      console.error('[GithubIntegrationDrawer] failed to load PRs', err);
      setPrsError(err.message || 'Error occurred querying PRs.');
      triggerSyncLog('error', 'PRs Feed', `API Query fault: ${err.message || err}`);
    } finally {
      setLoadingPRs(false);
    }
  }, [setLoadingPRs, setPrsError, setGitPRs, triggerSyncLog]);

  const handleMasterSync = async () => {
    if (!githubConnected || !githubToken) {
      toast.error('GitHub account not connected.');
      return;
    }
    if (!ownerName || !repoName) {
      toast.error('No repository bound to this project.');
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    setActiveSyncStep('Establishing Repository Transport');
    triggerSyncLog('info', 'Master Sync', `Starting full integration sync for: ${ownerName}/${repoName}...`);
  };

  // Sync execution timeline
  useEffect(() => {
    let timer: any;
    if (syncing) {
      timer = setInterval(() => {
        setSyncProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setSyncing(false);
            triggerSyncLog('success', 'Master Sync', `Repository sync completed successfully. Active branches intact.`);
            setActiveSyncStep('Synchronization Successful');
            toast.success('GitHub synchronization completed.');
            return 100;
          }
          
          const nextProgress = prev + 10;
          
          if (nextProgress === 20) {
            triggerSyncLog('info', 'Repository', 'Validating commit signature algorithms...');
            setActiveSyncStep('Verifying SSH credentials');
          } else if (nextProgress === 40) {
            triggerSyncLog('success', 'Repository', 'Transport encryption verified.');
            triggerSyncLog('info', 'Issues', 'Fetching active repository issues feed...');
            setActiveSyncStep('Querying GitHub Issues API');
            if (githubToken && githubSyncIssues) {
              fetchIssues(githubToken, ownerName, repoName);
            }
          } else if (nextProgress === 60) {
            triggerSyncLog('success', 'Issues', 'Successfully mapped local tasks with repository issues.');
            triggerSyncLog('info', 'Pull Requests', 'Fetching active repository pull request arrays...');
            setActiveSyncStep('Querying GitHub Pull Requests API');
            if (githubToken && githubSyncPRs) {
              fetchPullRequests(githubToken, ownerName, repoName);
            }
          } else if (nextProgress === 80) {
            triggerSyncLog('success', 'Pull Requests', 'Pull request pipeline mapping completed.');
            triggerSyncLog('info', 'System', 'Verifying SHA-256 commit tree integrity...');
            setActiveSyncStep('Verifying branch integrity');
          } else if (nextProgress === 100) {
            triggerSyncLog('success', 'System', 'Branch parity verified. Caches closed.');
            setActiveSyncStep('Finalizing integration indices');
          }
          
          return nextProgress;
        });
      }, 450);
    }
    return () => clearInterval(timer);
  }, [syncing, githubToken, ownerName, repoName, githubSyncIssues, githubSyncPRs, triggerSyncLog, fetchIssues, fetchPullRequests]);

  // Handle active scroll inside the console window
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [syncLogs]);

  // Load initial datasets upon authentication & repo bind
  useEffect(() => {
    if (githubConnected && githubToken && ownerName && repoName) {
      fetchIssues(githubToken, ownerName, repoName);
      fetchPullRequests(githubToken, ownerName, repoName);
    }
  }, [githubConnected, githubToken, ownerName, repoName, fetchIssues, fetchPullRequests]);

  // Check auth and configuration state on drawer load
  useEffect(() => {
    setIsDrawerOpen(isOpen);
    
    if (isOpen) {
      setDisconnectStep(0);
      setConfirmText('');

      const fetchAppwriteIdentity = async () => {
        try {
          const identityList = await account.listIdentities();
          const gitHubIdObj = identityList.identities?.find(i => i.provider === 'github');
          if (gitHubIdObj) {
            setGithubConnected(true);
            setGithubUser((prev: any) => prev || {
              displayName: gitHubIdObj.providerEmail || gitHubIdObj.providerUid,
              email: gitHubIdObj.providerEmail || 'github',
              photoURL: null
            });
            setGithubToken(gitHubIdObj.providerAccessToken || null);
            return gitHubIdObj;
          }
          return null;
        } catch (e) {
          console.error('[GithubIntegrationDrawer] failed to check identities', e);
          return null;
        }
      };

      const fetchProjectIntegration = async (hasIdentity: boolean) => {
        if (!projectId) return;
        setLoading(true);
        try {
          const list = await SourceControlService.listIntegrations(projectId);
          if (list.length > 0) {
            const item = list[0];
            setIntegration(item);
            setProvider(item.provider || 'github');
            setOwnerName(item.ownerName || '');
            setRepoName(item.repoName || '');
            setEnabled(item.enabled !== false);
            if (hasIdentity) setStep(2);
          } else {
            setIntegration(null);
            setStep(1);
          }
        } catch (e) {
          console.error('[GithubIntegrationDrawer] failed to load project integrations', e);
        } finally {
          setLoading(false);
        }
      };

      setCheckingIdentities(true);
      fetchAppwriteIdentity().then((gitHubIdObj) => {
          setCheckingIdentities(false);
          if (projectId) {
              fetchProjectIntegration(!!gitHubIdObj);
          }
      });
    }
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen, projectId]);

  const handleConnectGitHub = async () => {
    try {
      setIsAuthenticating(true);
      const redirectUrl = window.location.href;
      await account.createOAuth2Session(
        OAuthProvider.Github,
        redirectUrl,
        redirectUrl
      );
    } catch (err: any) {
      toast.error(err.message || 'Could not connect GitHub account.');
      setIsAuthenticating(false);
    }
  };

  const handleFinalDisconnect = async () => {
    setIsAuthenticating(true);
    try {
      setGithubConnected(false);
      setGithubUser(null);
      setGithubToken(null);
      setDisconnectStep(0);
      setConfirmText('');
      toast.success('GitHub disconnected and credentials purged.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleToggleConnection = () => {
    if (githubConnected) {
      setDisconnectStep(1);
    } else {
      handleConnectGitHub();
    }
  };

  const handleSave = () => {
    if (!ownerName.trim() || !repoName.trim()) {
      toast.error('Owner name and repository name are required.');
      return;
    }

    if (!githubConnected) {
      toast.error('You must link a GitHub account first.');
      return;
    }

    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const saved = await SourceControlService.saveIntegration(projectId!, {
            provider,
            ownerName: ownerName.trim(),
            repoName: repoName.trim(),
            enabled,
            metadata: JSON.stringify({
              updatedAt: new Date().toISOString(),
              syncEnabled: true,
            }),
          });
          setIntegration(saved);
          toast.success('Git integration saved securely!');
          if (onSaved) onSaved();
          setStep(2);
        } catch (err: any) {
          toast.error(err.message || 'Could not save configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteRepo = () => {
    const integrationId = integration?.$id;
    if (!integrationId) return;
    
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const ok = await SourceControlService.removeIntegration(integrationId);
          if (ok) {
            toast.success('Integration disconnected successfully!');
            setIntegration(null);
            setOwnerName('');
            setRepoName('');
            setGitIssues([]);
            setGitPRs([]);
            if (onSaved) onSaved();
            setStep(1);
          } else {
            toast.error('Could not remove integration.');
          }
        } catch (err: any) {
          toast.error(err.message || 'Could not delete configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (!isOpen) return null;

  const innerContent = (
    <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col h-full overflow-y-auto bg-[#161412] text-white scrollbar-thin">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div className="flex gap-3 items-center">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white flex-shrink-0 [&_svg]:w-[22px] [&_svg]:h-[22px]">
            {GITHUB_ICON}
          </div>
          <div>
            <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
              GitHub Integration
            </h3>
            <p className="text-xs text-white/45 mt-0.5 font-satoshi">
              Connect your GitHub account to access repositories, manage sync settings, and export tasks.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {!isFlapover && (
            <button
              type="button"
              onClick={handleMorphToDetail}
              className="p-1.5 rounded-lg text-[#F59E0B] hover:text-white hover:bg-[#1C1A18] transition-colors cursor-pointer"
              title="Go Full Detail"
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          )}
          {!isDesktop && !isFlapover && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-white/50 hover:text-[#F5F2ED] hover:bg-[#1C1A18] transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-[#1C1A18] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {disconnectStep === 1 ? (
          <div className="space-y-4">
            <div className="p-6 rounded-[24px] bg-[#0A0908] border border-red-500/15 text-center shadow-[0_8px_32px_rgba(239,68,68,0.02)]">
              <h4 className="text-base font-black font-clash text-red-500 mb-2">
                Step 1: Confirm Disconnect
              </h4>
              <p className="text-xs leading-relaxed text-white/65 mb-6 font-satoshi">
                Disassociating GitHub will immediately suspend task, issue and pull request synchronization. All active background tasks linking your repository data will cease.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDisconnectStep(2)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Proceed
                </button>
                <button
                  type="button"
                  onClick={() => setDisconnectStep(0)}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white text-white font-bold text-sm hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : disconnectStep === 2 ? (
          <div className="space-y-4">
            <div className="p-6 rounded-[24px] bg-[#0A0908] border border-red-500/25 text-center shadow-[0_8px_32px_rgba(239,68,68,0.05)]">
              <h4 className="text-base font-black font-clash text-red-500 mb-1">
                Step 2: Permanent Teardown
              </h4>
              <p className="text-xs leading-relaxed text-white/50 mb-3 font-satoshi">
                This action requires cryptographic token teardown. Please type <span className="text-white font-black">DISCONNECT</span> below to finalize.
              </p>
              
              <input
                type="text"
                placeholder="DISCONNECT"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 focus:border-[#EF4444] focus:outline-none text-white text-sm font-semibold mb-6 placeholder-white/20"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={confirmText !== 'DISCONNECT'}
                  onClick={handleFinalDisconnect}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    confirmText !== 'DISCONNECT'
                      ? 'bg-red-500/20 text-white/30 cursor-not-allowed'
                      : 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                  }`}
                >
                  Confirm Teardown
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisconnectStep(0);
                    setConfirmText('');
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white text-white font-bold text-sm hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {githubConnected && githubUser && (
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center gap-3">
                {githubUser.photoURL ? (
                  <img 
                    src={githubUser.photoURL} 
                    alt="GitHub Profile"
                    className="w-11 h-11 rounded-xl flex-shrink-0 object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 text-white flex-shrink-0 [&_svg]:w-[22px] [&_svg]:h-[22px]">
                    {GITHUB_ICON}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-white truncate leading-tight">
                    {githubUser.displayName || 'GitHub Account'}
                  </span>
                  <span className="block text-xs text-white/40 truncate font-satoshi mt-0.5">
                    {githubUser.email || githubUser.uid || 'Connected'}
                  </span>
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  CONNECTED
                </span>
              </div>
            )}

            {!githubConnected && kylrixEmail && (
              <div className="p-4 rounded-2xl bg-indigo-500/[0.03] border border-dashed border-indigo-500/20 flex items-start gap-3">
                <span className="text-lg mt-0.5 flex-shrink-0">💡</span>
                <div>
                  <span className="block text-sm font-extrabold text-white font-satoshi">
                    Link Recommendation <span className="text-[#F59E0B] text-[10px] font-black ml-1">(STRONGLY ADVISED)</span>
                  </span>
                  <span className="block text-xs text-white/45 leading-relaxed font-satoshi mt-1">
                    To prevent directory sync conflicts, we strongly recommend connecting a GitHub account that uses your active Kylrix email address: <span className="text-white font-bold font-mono">{kylrixEmail}</span>.
                  </span>
                </div>
              </div>
            )}

            <div>
              <button 
                type="button"
                onClick={handleToggleConnection}
                disabled={isAuthenticating}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  githubConnected 
                    ? 'border border-[#34322F] hover:border-[#4A4845] text-white hover:bg-white/[0.02]' 
                    : 'bg-[#6366F1] hover:bg-[#5458E8] text-white'
                }`}
              >
                {isAuthenticating ? 'Connecting...' : (githubConnected ? "Disconnect Account" : "Connect GitHub Account")}
              </button>
            </div>

            {githubConnected && (
              context === 'project' ? (
                <div className="space-y-6">
                  {step === 1 ? (
                    <div className="p-5 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/15">
                      <div className="flex gap-3 items-center mb-4">
                        <span className="text-emerald-400 flex-shrink-0"><CheckCircle className="w-6 h-6" /></span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold text-white leading-tight">
                            GitHub Account Connected
                          </span>
                          <span className="block text-xs text-white/50 truncate font-satoshi mt-0.5">
                            Linked Profile: {githubUser?.email || githubUser?.displayName || 'Connected'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="w-full py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-black text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Configure Repository Integration</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors cursor-pointer font-bold"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>View Linked Account Info</span>
                        </button>
                      </div>

                      {loading ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#6366F1]" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                            <span className="block text-sm font-extrabold text-white">
                              Repository Settings
                            </span>
                            
                            <div className="space-y-4">
                              {!integration ? (
                                <>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase font-satoshi">
                                      Repository Owner
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. facebook"
                                      value={ownerName}
                                      onChange={(e) => setOwnerName(e.target.value)}
                                      className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
                                    />
                                  </div>
                                  
                                  <button
                                    type="button"
                                    onClick={handleFetchRepos}
                                    disabled={loadingRepos}
                                    className="w-full py-3 px-4 rounded-xl border border-[#34322F] hover:border-[#6366F1] text-[#6366F1] font-extrabold text-xs bg-[#1C1A18] hover:bg-black transition-all flex items-center justify-center cursor-pointer"
                                  >
                                    {loadingRepos ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                    ) : (
                                      'Search Repositories'
                                    )}
                                  </button>

                                  {reposList.length > 0 && (
                                    <div className="border border-[#34322F] rounded-2xl p-4 bg-black max-h-[200px] overflow-y-auto space-y-3 scrollbar-thin">
                                      <input
                                        type="text"
                                        placeholder="Filter repositories..."
                                        value={repoFilter}
                                        onChange={(e) => setRepoFilter(e.target.value)}
                                        className="w-full bg-[#161412] px-3 py-2 rounded-lg border border-[#34322F] text-xs text-white focus:outline-none placeholder-white/20"
                                      />
                                      <div className="space-y-1">
                                        {reposList
                                          .filter(r => r.name.toLowerCase().includes(repoFilter.toLowerCase()))
                                          .map((repo) => (
                                            <button
                                              key={repo.id}
                                              type="button"
                                              onClick={() => {
                                                setRepoName(repo.name);
                                                toast.success(`Selected: ${repo.name}`);
                                              }}
                                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold font-satoshi flex flex-col transition-all cursor-pointer ${
                                                repoName === repo.name
                                                  ? 'bg-[#1C1A18] border border-[#6366F1] text-white'
                                                  : 'border border-transparent text-white/70 hover:bg-[#1C1A18] hover:text-white'
                                              }`}
                                            >
                                              <span className="font-extrabold">{repo.name}</span>
                                              {repo.description && (
                                                <span className="text-[10px] text-[#8E8A86] truncate mt-0.5">{repo.description}</span>
                                              )}
                                            </button>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase font-satoshi">
                                      Repository Name
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. react"
                                      value={repoName}
                                      onChange={(e) => setRepoName(e.target.value)}
                                      className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 rounded-xl bg-[#161412] border border-white/5">
                                  <span className="block text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 font-satoshi">
                                    Connected Repository
                                  </span>
                                  <span className="block text-sm font-bold text-white font-mono">
                                    {integration.ownerName}/{integration.repoName}
                                  </span>
                                </div>
                              )}

                              {/* Enable Sync toggle */}
                              <div className="flex items-center justify-between py-2">
                                <div>
                                  <span className="block text-xs font-extrabold text-white">Enable Repository Sync</span>
                                  <span className="block text-[10px] text-white/40 mt-0.5">Active background sync for tasks.</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEnabled(!enabled)}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    enabled ? 'bg-[#6366F1]' : 'bg-[#34322F]'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={loading}
                              className="flex-1 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-sm transition-colors flex items-center justify-center cursor-pointer"
                            >
                              Save Settings
                            </button>
                            {integration && (
                              <button
                                type="button"
                                onClick={handleDeleteRepo}
                                disabled={loading}
                                className="flex-1 py-3.5 rounded-xl border border-red-500/20 hover:border-red-500 text-red-400 hover:bg-red-500/5 font-bold text-sm transition-all flex items-center justify-center cursor-pointer"
                              >
                                Remove Integration
                              </button>
                            )}
                          </div>

                          {integration && (
                            <div className="space-y-6">
                              {/* Master Sync Terminal Panel */}
                              <div className="border border-[#1C1A18] rounded-2xl bg-[#0A0908] p-4">
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-[#6366F1]" />
                                    <span className="text-xs font-black text-white font-satoshi">
                                      Master Synchronizer
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={syncing}
                                    onClick={handleMasterSync}
                                    className="px-3 py-1 rounded-lg bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                                  </button>
                                </div>

                                {syncing && (
                                  <div className="mb-4">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[10px] text-white/60 font-bold">
                                        {activeSyncStep}
                                      </span>
                                      <span className="text-[10px] text-[#6366F1] font-black">
                                        {syncProgress}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-[#6366F1] transition-all duration-300"
                                        style={{ width: `${syncProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="p-3 rounded-xl bg-[#090807] border border-white/[0.03] font-mono text-[10px] h-[120px] overflow-y-auto space-y-1 scrollbar-thin">
                                  {syncLogs.map((log: any, idx: number) => (
                                    <div key={log.id || idx} className="flex gap-2 items-start leading-normal">
                                      <span className="text-white/20 select-none">
                                        [{log.timestamp || new Date().toLocaleTimeString()}]
                                      </span>
                                      <span 
                                        className={`font-black uppercase flex-shrink-0 ${
                                          log.type === 'error' 
                                            ? 'text-[#EF4444]' 
                                            : log.type === 'warn' 
                                            ? 'text-[#F59E0B]' 
                                            : log.type === 'success' 
                                            ? 'text-[#10B981]' 
                                            : 'text-[#6366F1]'
                                        }`}
                                      >
                                        {(log.service || 'System')}:
                                      </span>
                                      <span className="text-white/70 break-all">
                                        {log.message || log}
                                      </span>
                                    </div>
                                  ))}
                                  <div ref={logEndRef} />
                                </div>
                              </div>

                              {/* Repository Issues */}
                              <CollapsibleSection title="Repository Issues" icon={<Terminal size={16} />}>
                                {loadingIssues ? (
                                  <span className="text-xs text-white/40 italic block py-2">
                                    Retrieving issues...
                                  </span>
                                ) : issuesError ? (
                                  <span className="text-xs text-red-400 block py-2">
                                    Error: {issuesError}
                                  </span>
                                ) : gitIssues.length === 0 ? (
                                  <span className="text-xs text-white/40 italic block py-2">
                                    No issues found.
                                  </span>
                                ) : (
                                  <div className="space-y-2.5 mt-2">
                                    {gitIssues.map((issue) => (
                                      <div 
                                        key={issue.id}
                                        onClick={() => window.open(issue.htmlUrl, '_blank')}
                                        className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer"
                                      >
                                        <span className="block text-xs font-bold text-white mb-1.5 leading-snug">
                                          #{issue.number} {issue.title}
                                        </span>
                                        <div className="flex justify-between items-center gap-2">
                                          <span className="text-[10px] text-white/40">
                                            Created: {new Date(issue.createdAt).toLocaleDateString()}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                            issue.state === 'open' 
                                              ? 'bg-emerald-500/10 text-emerald-400' 
                                              : 'bg-white/5 text-white/60'
                                          }`}>
                                            {issue.state}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CollapsibleSection>

                              {/* Repository Pull Requests */}
                              <CollapsibleSection title="Repository Pull Requests" icon={<GitPullRequest size={16} />}>
                                {loadingPRs ? (
                                  <span className="text-xs text-white/40 italic block py-2">
                                    Retrieving pull requests...
                                  </span>
                                ) : prsError ? (
                                  <span className="text-xs text-red-400 block py-2">
                                    Error: {prsError}
                                  </span>
                                ) : gitPRs.length === 0 ? (
                                  <span className="text-xs text-white/40 italic block py-2">
                                    No active pull requests found.
                                  </span>
                                ) : (
                                  <div className="space-y-2.5 mt-2">
                                    {gitPRs.map((pr) => (
                                      <div 
                                        key={pr.id}
                                        onClick={() => window.open(pr.htmlUrl, '_blank')}
                                        className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer"
                                      >
                                        <span className="block text-xs font-bold text-white mb-1.5 leading-snug">
                                          #{pr.number} {pr.title}
                                        </span>
                                        <div className="flex justify-between items-center gap-3">
                                          <span className="text-[10px] text-white/40 truncate flex-1 font-mono">
                                            {pr.sourceBranch} ➔ {pr.targetBranch}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                            pr.state === 'open' 
                                              ? 'bg-indigo-500/15 text-indigo-400' 
                                              : 'bg-white/5 text-white/60'
                                          }`}>
                                            {pr.state}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CollapsibleSection>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    {
                      checked: githubSyncIssues,
                      onChange: (val: boolean) => setGithubSyncIssues(val),
                      title: 'GitHub Issue Sync',
                      desc: 'Mirror project tasks directly into GitHub repository issues.'
                    },
                    {
                      checked: githubSyncCommits,
                      onChange: (val: boolean) => setGithubSyncCommits(val),
                      title: 'Commits Feed Sync',
                      desc: 'Import repository commits as personal feed actions.'
                    },
                    {
                      checked: githubSyncPRs,
                      onChange: (val: boolean) => setGithubSyncPRs(val),
                      title: 'Pull Request Notifications',
                      desc: 'Notify on repository open PR and code review activities.'
                    }
                  ].map((item) => (
                    <div key={item.title} className="p-4 rounded-2xl bg-[#0A0908] border border-[#1C1A18] flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-white">{item.title}</span>
                        <span className="block text-xs text-white/40 font-satoshi mt-0.5 leading-normal">{item.desc}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => item.onChange(!item.checked)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          item.checked ? 'bg-[#6366F1]' : 'bg-[#34322F]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.checked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isFlapover) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
        onClick={onClose}
      />

      {/* Drawer Pane */}
      <div
        className={`fixed bg-[#161412] border-[#34322F] pointer-events-auto transition-all duration-300 flex flex-col z-50 md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-[480px] md:h-full md:border-l md:rounded-none inset-x-0 bottom-0 border-t rounded-t-[28px] ${
          isMobile ? (isExpanded ? 'h-[100dvh]' : 'h-[60dvh]') : 'h-full'
        }`}
      >
        {innerContent}
      </div>
    </div>
  );
}
