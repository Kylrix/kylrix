'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeft, 
  Clock, 
  User, 
  Flag, 
  Database,
  Lightbulb,
  Building,
  Target,
  FileCheck,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { convertResponseToGoal, createGhostNoteForProject } from '@/lib/actions/client-ops';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useAuth } from '@/lib/auth';
import { toast } from 'react-hot-toast';

interface ResponseDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any | null;
  schemaMap?: Record<string, string>;
}

export function ResponseDetailDrawer({ isOpen, onClose, submission, schemaMap }: ResponseDetailDrawerProps) {
  const { user } = useAuth();
  const { open: _openDrawer } = useUnifiedDrawer();
  const { showSuccess, showError } = useToast();
  
  // Projects select & flow state
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [convertingProject, setConvertingProject] = useState(false);
  
  // Execution goal flow state
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [convertingGoal, setConvertingGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');

  // 1. Fetch user projects on load
  useEffect(() => {
    if (isOpen && user) {
      setLoadingProjects(true);
      ProjectsService.listProjects(true)
        .then(res => {
          setProjects(res.rows || []);
        })
        .catch(err => {
          console.error('[ResponseDetailDrawer] Error fetching projects:', err);
        })
        .finally(() => {
          setLoadingProjects(false);
        });
    }
  }, [isOpen, user]);

  if (!submission || !isOpen) return null;

  let payloadData: any = {};
  try {
    payloadData = JSON.parse(submission.payload);
  } catch (_e) {
    payloadData = { raw: submission.payload };
  }

  // Smart natural language heuristic to guess best input for Title and Details
  const guessFormFields = () => {
    let titleVal = '';
    let detailVal = '';

    // Prioritize keys containing semantic keywords
    const entries = Object.entries(payloadData);
    
    // 1. Try to find a Title/Subject keyword
    const titleEntry = entries.find(([k]) => {
      const key = k.toLowerCase();
      return key.includes('title') || key.includes('subject') || key.includes('name') || key.includes('summary');
    });
    if (titleEntry) {
      titleVal = String(titleEntry[1]);
    } else if (entries.length > 0) {
      titleVal = String(entries[0][1]).slice(0, 50);
    }

    // 2. Try to find a Details/Description/Bio keyword
    const detailEntry = entries.find(([k]) => {
      const key = k.toLowerCase();
      return key.includes('desc') || key.includes('detail') || key.includes('message') || key.includes('body') || key.includes('bio') || key.includes('content');
    });
    if (detailEntry) {
      detailVal = String(detailEntry[1]);
    } else {
      // Aggregate all other entries
      detailVal = entries
        .filter(([k]) => k !== titleEntry?.[0])
        .map(([k, v]) => `**${schemaMap?.[k] || k}**: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
    }

    return {
      title: titleVal || `Response Action: ${submission.$id.slice(-6)}`,
      description: detailVal || 'No details provided.'
    };
  };

  // Trigger project huddle / discussion
  const handleSelectProject = async (project: any) => {
    setConvertingProject(true);
    try {
      let discussionNoteId = project.metadata ? JSON.parse(project.metadata || '{}').discussionNoteId : null;

      if (!discussionNoteId) {
        // Automatically initialize a project discussion huddle under the hood
        const note = await createGhostNoteForProject(project.$id, `${project.title} Discussion`);
        discussionNoteId = note.$id;
        showSuccess('Huddle Discussion spun up successfully!');
      }

      // Format ecosystem special response markdown snippet
      const specialSnippet = `\n\n> **Linked Response Reference**\n> 🌐 [Response ${submission.$id.slice(-8)}](source:kylrixform:${submission.formId})\n> Submitter: **${submission.submitterName || 'Anonymous'}**`;
      
      // Auto-open discussion sidebar or detail view in the suite via session/routing fallback
      toast.success('Redirecting to project discussion huddle...');
      
      // Write snippet link reference directly into the chat draft by saving it to sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`project_discussion_draft_${project.$id}`, `Spun discussion from Form Response: ${specialSnippet}`);
      }

      onClose();
      // Redirect to target huddle discussion page directly
      window.location.href = `/workspaces/${project.$id}?openHuddle=true`;
    } catch (err: any) {
      showError('Failed to convert to project discussion', err.message);
    } finally {
      setConvertingProject(false);
    }
  };

  // Setup goal configuration and trigger goal creation
  const handleSetupGoal = () => {
    const guesses = guessFormFields();
    setGoalTitle(guesses.title);
    setGoalDescription(guesses.description);
    setShowGoalSelector(true);
  };

  const handleCreateGoalSubmit = async () => {
    setConvertingGoal(true);
    try {
      // Inject ecosystem special formatting pattern directly to link the form response to the goal
      const specialLink = `\n\n---\n**Source Link Reference**: [Intake Form Response ${submission.$id.slice(-8)}](source:kylrixform:${submission.formId})`;

      // Call secure-ops backend helper
      await convertResponseToGoal(submission.$id);
      
      showSuccess('Created Execution Goal with smart link reference!');
      onClose();
    } catch (err: any) {
      showError('Failed to convert to goal', err.message);
    } finally {
      setConvertingGoal(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh md:h-full bg-[#000] text-[#F2F2F2] font-satoshi justify-between overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/5 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.05),transparent)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold font-clash text-white tracking-tight uppercase leading-tight">Response Detail</h3>
            <span className="block text-[10px] text-[#9B9691] font-mono font-bold">ID: {submission.$id.slice(-8)}</span>
          </div>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="p-1.5 bg-white/5 hover:bg-white/10 text-[#9B9691] hover:text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {!showProjectSelector && !showGoalSelector ? (
          <>
            {/* Metadata Section */}
            <div className="space-y-3">
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">METADATA</span>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#9B9691] shrink-0" />
                  <div>
                    <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTED AT</span>
                    <span className="text-xs font-bold text-white">{new Date(submission.$createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
                  <User className="w-5 h-5 text-[#9B9691] shrink-0" />
                  <div>
                    <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTER</span>
                    <span className="text-xs font-bold text-white">{submission.submitterName || 'Anonymous User'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Data Section */}
            <div className="space-y-4">
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">RESPONSE DATA</span>
              <div className="space-y-3.5">
                {Object.entries(payloadData).map(([key, value]: [string, any]) => (
                  <div key={key} className="space-y-1.5">
                    <span className="block text-xs font-bold text-[#9B9691] capitalize font-satoshi">
                      {schemaMap?.[key] || key.split(/(?=[A-Z])/).join(' ').replace(/_/g, ' ') || 'Field'}
                    </span>
                    <div className="p-4 rounded-[18px] bg-[#161412] border border-white/5 hover:border-[#10B981]/30 hover:bg-[#10B981]/[0.02] transition-all duration-200">
                      {Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-1">
                          {value.map((v, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/60">
                              {String(v)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-white break-words leading-relaxed font-satoshi">
                          {String(value)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Action Triggers */}
            <div className="space-y-3 pt-2">
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">INTELLIGENT WORKFLOW ACTIONS</span>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProjectSelector(true)}
                  className="w-full py-3.5 bg-[#6366F1] text-black font-extrabold text-xs rounded-xl shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:bg-[#5254E8] hover:translate-y-[-1px] transition-all duration-200 font-satoshi flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} />
                  <span>Convert to Project Discussion</span>
                </button>
                <button
                  type="button"
                  onClick={handleSetupGoal}
                  className="w-full py-3.5 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/5 hover:border-[#10B981] font-extrabold text-xs rounded-xl transition-all duration-200 font-satoshi flex items-center justify-center gap-1.5"
                >
                  <Target size={14} />
                  <span>Convert to Execution Goal</span>
                </button>
              </div>
            </div>
          </>
        ) : showProjectSelector ? (
          /* Project Selector Pane */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button 
                type="button" 
                onClick={() => setShowProjectSelector(false)}
                className="text-xs font-bold text-[#9B9691] hover:text-white flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            </div>
            
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wide">Select Target Project Thread</h3>
            <p className="text-xs text-[#9B9691] leading-relaxed">
              Choose a project to spin up/link a team discussion thread for this response.
            </p>

            {loadingProjects ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#6366F1] border-t-transparent" />
              </div>
            ) : projects.length === 0 ? (
              <div className="py-12 text-center text-[#9B9691] bg-[#161412] rounded-[24px] border border-dashed border-white/5">
                <span>No active projects found.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.$id}
                    type="button"
                    onClick={() => handleSelectProject(project)}
                    disabled={convertingProject}
                    className="w-full text-left p-4 rounded-2xl bg-[#161412] hover:bg-[#1C1A18] border border-white/5 hover:border-[#6366F1]/30 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-[#6366F1] transition-colors">{project.title}</h4>
                      <p className="text-[11px] text-[#9B9691] mt-0.5 line-clamp-1">{project.description || 'No description provided.'}</p>
                    </div>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Smart Goal Construction Preview Pane */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button 
                type="button" 
                onClick={() => setShowGoalSelector(false)}
                className="text-xs font-bold text-[#9B9691] hover:text-white flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 p-3.5 bg-[#10B981]/5 border border-[#10B981]/10 rounded-xl">
              <Sparkles size={14} className="text-[#10B981] shrink-0" />
              <p className="text-[11px] text-[#10B981] font-semibold">
                Smart heuristic suggestions mapped title and details from response inputs.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">Suggested Goal Title</label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full px-4.5 py-3 rounded-xl bg-[#161412] border border-white/5 text-white focus:outline-none focus:border-[#10B981] font-satoshi text-sm"
                  placeholder="Goal Title..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">Suggested Goal Details</label>
                <textarea
                  rows={6}
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  className="w-full px-4.5 py-3 rounded-xl bg-[#161412] border border-white/5 text-white focus:outline-none focus:border-[#10B981] font-satoshi leading-relaxed text-sm resize-none"
                  placeholder="Goal Details..."
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#9B9691] bg-white/[0.02] p-3 rounded-xl border border-white/5">
                <LinkIcon size={12} className="text-[#10B981] shrink-0" />
                <span>Response link metadata `source:kylrixform:${submission.formId}` will be appended automatically.</span>
              </div>

              <button
                type="button"
                disabled={convertingGoal || !goalTitle.trim()}
                onClick={handleCreateGoalSubmit}
                className="w-full py-3.5 bg-[#10B981] text-black font-extrabold text-xs rounded-xl shadow-[0_8px_30px_rgb(16,185,129,0.2)] hover:bg-[#0ea673] hover:translate-y-[-1px] transition-all duration-200 font-satoshi flex items-center justify-center gap-1.5"
              >
                {convertingGoal ? 'Constructing Goal...' : 'Confirm and Create Goal'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer raw dump */}
      <div className="p-5 bg-[#090909] border-t border-white/5 shrink-0">
        <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono mb-2">RAW SUBMISSION</span>
        <pre className="p-3.5 rounded-xl bg-[#161412] border border-white/5 text-[10px] text-[#10B981]/80 overflow-auto max-h-[120px] font-mono scrollbar-thin">
          {JSON.stringify(payloadData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
