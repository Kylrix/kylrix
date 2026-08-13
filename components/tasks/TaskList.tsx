'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles, ChevronDown, ChevronUp, Tag, X, RefreshCw } from 'lucide-react';
import GoalObjectRow from './GoalObjectRow';
import { useTask } from '@/context/TaskContext';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useAuth } from '@/context/auth/AuthContext';
import { toast } from 'react-hot-toast';

import { EmptyStateAnomalyDetector } from '@/context/NeuralContext';

export default function TaskList() {
  const {
    getFilteredTasks,
    filter,
    setFilter,
    deleteTask,
    projects,
    selectedProjectId,
    getTagFilterOptions,
    labels,
    isLoading,
    refreshTasks} = useTask();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open } = useUnifiedDrawer();
  const { isAuthenticated, openIDMWindow } = useAuth();

  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const openCreateGoal = useCallback(() => {
    if (!isAuthenticated) {
      openIDMWindow?.();
      return;
    }
    setCreateOpen(true);
  }, [isAuthenticated, openIDMWindow]);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      resetConfiguration();
      return;
    }
    setConfiguration({
      isVisible: true,
      mainColor: '#A855F7',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: openCreateGoal,
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openCreateGoal, isDesktop]);

  const tagFilterOptions = getTagFilterOptions();
  const activeTagFilter = filter.labels?.[0] ?? null;

  const handleTagFilterToggle = (tag: string) => {
    if (activeTagFilter === tag) {
      setFilter({ ...filter, labels: [] });
      return;
    }
    setFilter({ ...filter, labels: [tag] });
  };

  const getTagColor = (tagName: string) =>
    labels.find((label) => label.name === tagName)?.color || '#9B9691';

  const tasks = getFilteredTasks();
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedTasks = tasks.filter(t => t.status === 'done');

  const GOAL_PAGE_SIZE = 20;
  const [goalPage, setGoalPage] = useState(1);
  const [goalSentinelNode, setGoalSentinelNode] = useState<HTMLDivElement | null>(null);
  const goalSentinelRef = useCallback((node: HTMLDivElement | null) => setGoalSentinelNode(node), []);
  const visibleActiveTasks = activeTasks.slice(0, goalPage * GOAL_PAGE_SIZE);
  const hasMoreGoals = visibleActiveTasks.length < activeTasks.length;
  useEffect(() => {
    setGoalPage(1);
  }, [tasks.length, filter.search, filter.status, filter.labels]);
  useEffect(() => {
    if (!goalSentinelNode || !hasMoreGoals) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setGoalPage((p) => p + 1);
      },
      { rootMargin: '400px', threshold: 0.1 }
    );
    obs.observe(goalSentinelNode);
    return () => obs.disconnect();
  }, [goalSentinelNode, hasMoreGoals, activeTasks.length]);

  const handleBulkDeleteCompleted = () => {
    if (completedTasks.length === 0) return;

    open('delete-confirm', {
      title: `Purge ${completedTasks.length} Completed Goals?`,
      description: 'This will authoritatively erase all finished goals, including their sub-objects (subtasks, comments, attachments, and project links). This operation is final and irreversible.',
      resourceName: 'completed goals',
      confirmLabel: 'Purge Finished Goals',
      onConfirm: async () => {
        const total = completedTasks.length;
        let count = 0;
        try {
          for (const task of completedTasks) {
            await deleteTask(task.id);
            count++;
          }
          toast.success(`Workspace cleansed: ${total} goals removed.`);
        } catch (err) {
          console.error('[Purge] Failed after', count, 'tasks:', err);
          toast.error('Partial purge completed. Check connection.');
        }
      }
    });
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const getViewTitle = () => {
    if (activeTagFilter) return `Tag: ${activeTagFilter}`;
    if (selectedProject) return selectedProject.name;
    if (filter.status?.includes('done')) return 'Completed Goals';
    if (filter.dueDate?.from && filter.dueDate?.to) {
      const from = new Date(filter.dueDate.from);
      const _to = new Date(filter.dueDate.to);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (from.toDateString() === today.toDateString()) return 'Today';
      if (from.toDateString() === tomorrow.toDateString()) return 'Upcoming';
    }
    if (filter.dueDate?.to && !filter.dueDate.from) return 'Overdue';
    return 'All Goals';
  };

  // Group tasks by status for board view
  const groupedTasks = {
    todo: tasks.filter((t) => t.status === 'todo'),
    'in-progress': tasks.filter((t) => t.status === 'in-progress'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    done: tasks.filter((t) => t.status === 'done')};

  return (
    <EmptyStateAnomalyDetector
      componentName="TaskList"
      expectedItemKind="goal"
      itemCount={tasks.length}
      isLoading={isLoading}
      onHeal={refreshTasks}
    >
      <div className="animate-fadeIn pointer-events-auto w-full">
        {/* Desktop & Mobile Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 md:p-6 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none mb-6 md:mb-8">
          <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent" />
          
          <div>
            <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
              {getViewTitle()}
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]" />
              <span className="font-mono text-xs font-bold text-white/40 uppercase tracking-wider">
                <span className="text-[#A855F7] font-bold">{tasks.length}</span> {tasks.length === 1 ? 'Goal' : 'Goals'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshTasks}
              disabled={isLoading}
              className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
              title="Refresh Goals"
            >
              <RefreshCw size={16} className={`transition-all ${isLoading ? 'animate-spin text-[#A855F7]' : 'text-white/60'}`} />
            </button>

            {/* Add Goal Button (Desktop) */}
            <button
              type="button"
              onClick={openCreateGoal}
              className="hidden sm:flex items-center gap-1.5 h-10 px-4 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/20 hover:border-[#A855F7]/40 text-[#C084FC] font-bold rounded-xl transition-all text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Goal</span>
            </button>
          </div>
        </header>

        {tagFilterOptions.length > 0 && (
          <div className="overflow-x-auto scrollbar-none mb-6 p-2 bg-white/[0.01] border border-white/5 rounded-[24px] flex items-center gap-2 select-none">
            <Tag size={14} className="text-[#A855F7]/60 ml-2 shrink-0" />
            {tagFilterOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={activeTagFilter === tag}
                onClick={() => handleTagFilterToggle(tag)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeTagFilter === tag
                    ? 'bg-[#A855F7] border-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.2)]'
                    : 'bg-white/3 border-white/8 text-white/60 hover:text-white hover:border-white/15'
                }`}
                style={
                  activeTagFilter !== tag
                    ? { borderColor: `${getTagColor(tag)}33`, color: getTagColor(tag) }
                    : undefined
                }
              >
                {tag}
              </button>
            ))}
            {activeTagFilter && (
              <button
                type="button"
                onClick={() => setFilter({ ...filter, labels: [] })}
                className="ml-1 px-3 py-1.5 text-xs text-[#A855F7] hover:text-[#c084fc] font-mono font-bold tracking-wider flex items-center gap-1 shrink-0"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Grid Content */}
        <div className="min-h-[60vh]">
          <div className="space-y-8">
            {tasks.length === 0 ? (
              <div className="text-center py-24 text-[#9B9691]">
                <h3 className="font-clash font-extrabold text-[#F5F2ED] text-xl tracking-tight mb-2">
                  A Clear Void
                </h3>
                <p className="font-satoshi text-sm mb-6 text-[#9B9691]">
                  {filter.search
                    ? 'No action items match your parameters.'
                    : 'Establish order. Bring structure to your goals.'}
                </p>
                <button
                  type="button"
                  onClick={openCreateGoal}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[#1C1A18] hover:border-[#34322F] text-[#F5F2ED] font-bold rounded-xl hover:bg-[#161412] transition-colors font-satoshi text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Your First Goal</span>
                </button>
              </div>
            ) : (
              <>
                {/* Active Goals Section */}
                {activeTasks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1 mb-2">
                      <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-[0.2em] font-mono">
                        Active Goals ({activeTasks.length})
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#A855F7]/20 to-transparent" />
                    </div>
                    <div className="grid gap-4 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                      {visibleActiveTasks.map((task) => <GoalObjectRow key={task.id} task={task} />)}
                    </div>
                    {hasMoreGoals && (
                      <div ref={goalSentinelRef} className="flex justify-center py-6">
                        <span className="text-xs font-bold tracking-widest uppercase text-white/25">Loading more…</span>
                      </div>
                    )}
                    {!hasMoreGoals && visibleActiveTasks.length > 0 && activeTasks.length > GOAL_PAGE_SIZE && (
                      <div className="flex justify-center py-4">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-white/15">End of list</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Completed Goals Section */}
                {completedTasks.length > 0 && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <button 
                        onClick={() => setShowCompletedSection(!showCompletedSection)}
                        className="flex items-center gap-2 group cursor-pointer"
                      >
                        <span className="text-[10px] font-black text-[#9B9691] uppercase tracking-[0.2em] font-mono group-hover:text-white transition-colors">
                          Completed ({completedTasks.length})
                        </span>
                        {showCompletedSection ? <ChevronUp size={12} className="text-[#9B9691]" /> : <ChevronDown size={12} className="text-[#9B9691]" />}
                      </button>
                      <div className="flex-1 mx-4 h-px bg-[#1C1A18]" />
                    </div>

                    {showCompletedSection && (
                      <>
                        {/* Cleanup Pulse Card */}
                        <div className="bg-[#161412] border border-[#A855F7]/10 rounded-[28px] p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:border-[#A855F7]/20 relative overflow-hidden group/cleanup">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-[#A855F7]/5 rounded-full blur-3xl pointer-events-none group-hover/cleanup:bg-[#A855F7]/10 transition-all duration-500" />
                           <div className="flex items-center gap-4 relative z-10">
                              <div className="w-12 h-12 rounded-xl bg-[#A855F7]/10 text-[#A855F7] flex items-center justify-center flex-shrink-0">
                                  <Sparkles size={22} />
                              </div>
                              <div className="min-w-0 flex-1">
                                  <h4 className="text-white font-black text-sm uppercase tracking-tight">Workspace Integrity</h4>
                                  <p className="text-[#9B9691] text-[11px] font-bold uppercase tracking-wider mt-0.5 leading-normal">
                                      Purge finished goals to maintain a lean, high-fidelity environment.
                                  </p>
                              </div>
                           </div>
                           <button
                              onClick={handleBulkDeleteCompleted}
                              className="relative z-10 px-5 py-2.5 rounded-xl bg-[#1C1A18] border border-white/5 text-white/70 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-[0.98] flex items-center gap-2"
                           >
                              <Trash2 size={14} />
                              Purge All
                           </button>
                        </div>

                        <div className="grid gap-4 items-stretch opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                          {completedTasks.map((task) => <GoalObjectRow key={task.id} task={task} />)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ObjectCreateDrawer
        open={createOpen}
        kind="goal"
        onClose={() => setCreateOpen(false)}
        onGoalCreated={() => {
          toast.success('Goal saved locally');
        }}
      />
    </EmptyStateAnomalyDetector>
  );
}
