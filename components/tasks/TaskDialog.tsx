'use client';

import React, { useState, useEffect } from 'react';
import UserSearch from '@/components/UserSearch';
import { useTask } from '@/context/TaskContext';
import { Priority, TaskStatus } from '@/types';
import { ArrowUpRight, ChevronUp, ChevronDown, X, Type } from 'lucide-react';
import { useSection } from '@/context/SectionContext';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import TaskDetails from './TaskDetails';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' }];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' }];

export default function TaskDialog() {
  const { setActiveDetail } = useSection();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const [isDesktop, setIsDesktop] = React.useState(true);

  React.useEffect(() => {
    const checkViewport = () => setIsDesktop(window.innerWidth >= 768);
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);
  
  const {
    taskDialogOpen,
    setTaskDialogOpen,
    addTask,
    projects,
    labels,
    selectedProjectId,
    userId: creatorId,
    ecosystemTags,
    refreshEcosystemTags,
  } = useTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState(selectedProjectId || 'inbox');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    if (taskDialogOpen) {
      void refreshEcosystemTags();
    }
  }, [taskDialogOpen, refreshEcosystemTags]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load draft when dialog opens
  useEffect(() => {
    if (!taskDialogOpen || typeof window === 'undefined') {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:task');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.isTitleManuallyEdited) setIsTitleManuallyEdited(draft.isTitleManuallyEdited);
        if (draft.priority) setPriority(draft.priority);
        if (draft.status) setStatus(draft.status);
        if (draft.projectId) setProjectId(draft.projectId);
        if (draft.selectedLabels) setSelectedLabels(draft.selectedLabels);
        if (draft.dueDate) setDueDate(new Date(draft.dueDate));
        if (draft.estimatedTime) setEstimatedTime(draft.estimatedTime);
        if (draft.selectedAssignees) setSelectedAssignees(draft.selectedAssignees);
      } catch (e) {
        console.error('Failed to parse task draft', e);
      }
    }
    setIsHydrated(true);
  }, [taskDialogOpen]);

  // Save draft on fields change
  useEffect(() => {
    if (!taskDialogOpen || typeof window === 'undefined' || !isHydrated) return;
    const draft = {
      title,
      description,
      isTitleManuallyEdited,
      priority,
      status,
      projectId,
      selectedLabels,
      dueDate: dueDate ? dueDate.toISOString() : null,
      estimatedTime,
      selectedAssignees,
    };
    if (title.trim() || description.trim() || selectedLabels.length > 0 || selectedAssignees.length > 0) {
      localStorage.setItem('kylrix:draft:task', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:task');
    }
  }, [taskDialogOpen, isHydrated, title, description, isTitleManuallyEdited, priority, status, projectId, selectedLabels, dueDate, estimatedTime, selectedAssignees]);

  // Auto-generate title from description
  useEffect(() => {
    if (isTitleManuallyEdited) return;
    const generated = buildAutoTitleFromContent(description);
    if (description.trim()) {
      setTitle(generated || 'Untitled Goal');
    } else {
      setTitle('');
    }
  }, [description, isTitleManuallyEdited]);

  const handleClose = () => {
    setTaskDialogOpen(false);
    resetForm();
    setIsExpanded(false);
    setIsHydrated(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsTitleManuallyEdited(false);
    setShowTitleInput(false);
    setPriority('medium');
    setStatus('todo');
    setProjectId(selectedProjectId || 'inbox');
    setSelectedLabels([]);
    setDueDate(null);
    setEstimatedTime('');
    setSelectedAssignees([]);
  };

  const handleMorphToDetail = async () => {
    const finalTitle = title.trim() || buildAutoTitleFromContent(description) || 'Untitled Goal';

    const newTask = await addTask({
      title: finalTitle,
      description: description.trim() || undefined,
      priority,
      status,
      projectId,
      labels: selectedLabels,
      dueDate: dueDate || undefined,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      subtasks: [],
      comments: [],
      attachments: [],
      reminders: [],
      timeEntries: [],
      assigneeIds: selectedAssignees.length > 0
        ? selectedAssignees.map(u => u.id).filter((id): id is string => id !== null)
        : creatorId && creatorId !== 'guest'
          ? [creatorId]
          : [],
      creatorId: creatorId || 'guest',
      isPinned: false,
      isArchived: false,
    });

    if (newTask && newTask.id) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:task');
      }
      if (isDesktop) {
        openSidebar(
          <TaskDetails taskId={newTask.id} />,
          newTask.id,
          { hideHeader: true }
        );
      } else {
        openOverlay(
          <TaskDetails taskId={newTask.id} onBack={closeOverlay} />
        );
      }
    }
    handleClose();
  };

  const handleSubmit = () => {
    const finalTitle = title.trim() || buildAutoTitleFromContent(description) || 'Untitled Goal';

    addTask({
      title: finalTitle,
      description: description.trim() || undefined,
      priority,
      status,
      projectId,
      labels: selectedLabels,
      dueDate: dueDate || undefined,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      subtasks: [],
      comments: [],
      attachments: [],
      reminders: [],
      timeEntries: [],
      assigneeIds: selectedAssignees.length > 0
        ? selectedAssignees.map(u => u.id).filter((id): id is string => id !== null)
        : creatorId && creatorId !== 'guest'
          ? [creatorId]
          : [],
      creatorId: creatorId || 'guest',
      isPinned: false,
      isArchived: false,
    });

    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:task');
    }
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  if (!taskDialogOpen) return null;

  return (
    <>
      {/* 1. Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1400] transition-opacity duration-300 ease-in-out cursor-default"
        onClick={handleClose}
      />
      
      {/* 2. Slide-up Panel Container */}
      <div 
        className={`fixed bottom-0 md:bottom-auto md:top-0 right-0 z-[1410] bg-[#161412] text-white p-6 md:p-8 flex flex-col gap-6 shadow-[0_24px_48px_rgba(0,0,0,0.9)] transition-all duration-300 overflow-y-auto w-full max-w-full md:w-[640px] md:h-full md:max-h-full md:border-l md:border-[#1C1A18] ${
          isMobile 
            ? (isExpanded ? 'h-[100dvh] rounded-t-0' : 'h-[60dvh] rounded-t-[26px]') 
            : 'h-full'
        }`}
      >
        {/* Decorative drag handle bar for mobile */}
        {isMobile && (
          <div className="w-10 h-1 bg-white/12 rounded-[2px] mx-auto mb-2 flex-shrink-0" />
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1A18] flex-shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <h3 className="text-white text-lg font-black tracking-tight font-clash leading-snug break-words [overflow-wrap:anywhere]">
              {(!showTitleInput && title) ? title.toUpperCase() : "NEW GOAL"}
            </h3>
            <p className="text-[#9B9691] text-[10px] font-bold mt-1 tracking-wider uppercase truncate">
              {(!showTitleInput && title) ? "Auto-generated Title" : "INITIALIZE EXECUTION TRACK"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowTitleInput(!showTitleInput)}
              className={`p-1.5 rounded-lg transition-all ${showTitleInput ? 'text-[#A855F7] bg-[#A855F7]/10' : 'text-[#9B9691] hover:text-white hover:bg-white/5'}`}
              title="Toggle Manual Title"
            >
              <Type size={20} />
            </button>
            {(title.trim().length > 0 || description.trim().length > 0) && (
              <button
                type="button"
                onClick={handleMorphToDetail}
                className="p-1.5 text-[#F59E0B] hover:text-white rounded-lg hover:bg-white/5 transition-all"
                title="Go Full Detail"
              >
                <ArrowUpRight size={20} />
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-[#9B9691] hover:text-[#F5F2ED] rounded-lg hover:bg-white/5 transition-all"
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-[#9B9691] hover:text-[#F5F2ED] rounded-lg hover:bg-white/5 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Form */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6" onKeyDown={handleKeyDown}>
          {/* Title Input (Secondary/Optional) */}
          {showTitleInput && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">GOAL TITLE</label>
              <input
                type="text"
                placeholder="Explicit objective name..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsTitleManuallyEdited(true);
                }}
                className="w-full bg-transparent text-xl font-bold tracking-tight text-[#F5F2ED] placeholder:opacity-30 focus:outline-none border-b border-[#1C1A18] pb-2"
              />
            </div>
          )}

          {/* Description Input (Primary) */}
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">OBJECTIVE DETAILS</label>
            <textarea
              autoFocus={!showTitleInput}
              placeholder="What needs to be done? Establish the context and parameters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent text-lg font-medium text-[#F5F2ED] placeholder:opacity-40 focus:outline-none resize-none leading-relaxed flex-1 min-h-[120px]"
            />
          </div>

          <hr className="border-[#1C1A18]" />

          {/* Settings Container */}
          <div className="flex flex-col gap-5 p-5 rounded-[24px] bg-[#1C1A18] border border-[#2C2A28]">
            {/* Project & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">PROJECT</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-[#161412] border border-[#2C2A28] rounded-xl px-3 py-2.5 text-sm text-[#F5F2ED] font-semibold focus:outline-none focus:border-[#A855F7] transition-colors cursor-pointer"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">PRIORITY</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-[#161412] border border-[#2C2A28] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#A855F7] transition-colors cursor-pointer"
                  style={{ color: priorityOptions.find(p => p.value === priority)?.color }}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: option.color }}>
                      {option.label.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">DEADLINE</label>
                <input
                  type="date"
                  value={dueDate ? dueDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : null)}
                  className="w-full bg-[#161412] border border-[#2C2A28] rounded-xl px-3 py-2.5 text-sm text-[#F5F2ED] font-semibold focus:outline-none focus:border-[#A855F7] transition-colors cursor-pointer"
                />
              </div>

              {/* Status Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">STATUS</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full bg-[#161412] border border-[#2C2A28] rounded-xl px-3 py-2.5 text-sm text-[#F5F2ED] font-semibold focus:outline-none focus:border-[#A855F7] transition-colors cursor-pointer"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Labels Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">TAGS</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {selectedLabels.map((tagName) => {
                const tag = ecosystemTags.find(t => t.name === tagName);
                const color = (tag as any)?.color || '#9B9691';
                return (
                  <span
                    key={tagName}
                    onClick={() => setSelectedLabels(prev => prev.filter(name => name !== tagName))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1C1A18] text-[10px] font-extrabold font-mono rounded-lg border cursor-pointer hover:bg-[#2C2A28] transition-colors"
                    style={{ color: color, borderColor: color }}
                  >
                    {tagName.toUpperCase()}
                    <X size={10} />
                  </span>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => openUnified('tag-selector', {
                selectedTags: selectedLabels,
                onSelect: (tagName: string) => {
                  if (!selectedLabels.includes(tagName)) {
                    setSelectedLabels(prev => [...prev, tagName]);
                  }
                }
              })}
              className="w-full flex items-center justify-between bg-[#161412] border border-[#1C1A18] rounded-xl px-3 py-2.5 text-sm text-[#9B9691] font-semibold hover:border-[#6366F1] hover:text-white transition-all cursor-pointer"
            >
              <span>{selectedLabels.length > 0 ? 'Add more tags...' : 'Add tags to this goal...'}</span>
              <ArrowUpRight size={14} className="opacity-40" />
            </button>
          </div>

          <hr className="border-[#1C1A18]" />

          {/* Assignees */}
          <UserSearch
            label="ASSIGNEES"
            selectedUsers={selectedAssignees}
            onSelect={(user) => setSelectedAssignees(prev => [...prev, user])}
            onRemove={(userId) => setSelectedAssignees(prev => prev.filter(u => u.id !== userId))}
            excludeIds={creatorId ? [creatorId] : []}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1C1A18] flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-sm text-[#9B9691] font-bold hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-6 py-2.5 text-sm text-[#0A0908] bg-[#A855F7] hover:bg-[#9333EA] disabled:bg-[#1C1A18] disabled:text-[#34322F] font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(168, 85, 247, 0.2)] disabled:shadow-none"
          >
            Create Goal
          </button>
        </div>
      </div>
    </>
  );
}
