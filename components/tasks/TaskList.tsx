'use client';

import React, { useState } from 'react';
import { Plus, ArrowUpDown, Filter, List, LayoutGrid, Calendar, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import TaskItem from './TaskItem';
import { useRouter } from 'next/navigation';
import { useTask } from '@/context/TaskContext';
import { useFAB } from '@/context/FABContext';
import { ViewMode, SortField, TaskStatus } from '@/types';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function TaskList() {
  const {
    getFilteredTasks,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filter,
    setFilter,
    setTaskDialogOpen,
    projects,
    selectedProjectId,
  } = useTask();
  const { setConfiguration, resetConfiguration } = useFAB();
  const router = React.useRef(useRouter()).current;

  React.useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#A855F7',
      actions: [
        { id: 'new-goal', label: 'NEW GOAL', icon: <Plus className="h-5 w-5" />, onClick: () => setTaskDialogOpen(true) },
        { id: 'focus', label: 'FOCUS MODE', icon: <Calendar className="h-5 w-5" />, onClick: () => window.location.href = '/flow/focus' }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, setTaskDialogOpen]);

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const tasks = getFilteredTasks();
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'dueDate', label: 'Due Date' },
    { field: 'priority', label: 'Priority' },
    { field: 'createdAt', label: 'Created Date' },
    { field: 'updatedAt', label: 'Last Updated' },
    { field: 'title', label: 'Title' },
    { field: 'status', label: 'Status' }];

  const statusFilters: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'todo', label: 'To Do', color: '#9E9E9E' },
    { status: 'in-progress', label: 'In Progress', color: '#0288D1' },
    { status: 'done', label: 'Done', color: '#2E7D32' },
    { status: 'blocked', label: 'Blocked', color: '#D32F2F' }];

  const handleSortChange = (field: SortField) => {
    if (sort.field === field) {
      setSort({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field, direction: 'asc' });
    }
  };

  const handleStatusFilterToggle = (status: TaskStatus) => {
    const currentStatuses = filter.status || [];
    if (currentStatuses.includes(status)) {
      setFilter({
        ...filter,
        status: currentStatuses.filter((s) => s !== status),
      });
    } else {
      setFilter({
        ...filter,
        status: [...currentStatuses, status],
      });
    }
  };

  const getViewTitle = () => {
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
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <div className="animate-fadeIn min-h-screen bg-[#0A0908] p-4 md:p-8 pointer-events-auto">
      <MultiSectionContainer panels={['forms', 'huddles', 'projects']}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4 sm:gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-clash font-extrabold text-[#F5F2ED] tracking-tight mb-1">
              {getViewTitle()}
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]" />
              <span className="font-satoshi text-xs font-semibold text-[#9B9691] uppercase tracking-wider">
                {tasks.length} {tasks.length === 1 ? 'Goal' : 'Goals'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-[#161412] p-1 rounded-xl border border-[#1C1A18]">
              {[
                { id: 'list', icon: List, label: 'List' },
                { id: 'board', icon: LayoutGrid, label: 'Board' },
                { id: 'calendar', icon: Calendar, label: 'Calendar' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id as ViewMode)}
                  className={`rounded-lg px-2 sm:px-3 py-1 transition-colors ${
                    viewMode === mode.id
                      ? 'bg-[#1C1A18] text-[#A855F7]'
                      : 'text-[#9B9691] hover:bg-[#1C1A18]'
                  }`}
                >
                  <mode.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </button>
              ))}
            </div>

            <div className="hidden sm:block h-6 w-[1px] bg-[#1C1A18]" />

            {/* Sort & Filter Group */}
            <div className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsSortOpen(!isSortOpen);
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-[#161412] border border-[#1C1A18] hover:border-[#34322F] text-[#F5F2ED] rounded-xl transition-colors font-satoshi"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort</span>
                </button>
                {isSortOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSortOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#161412] border border-[#1C1A18] shadow-2xl p-2 z-50 font-satoshi text-left">
                      {sortOptions.map((option) => (
                        <button
                          key={option.field}
                          type="button"
                          onClick={() => {
                            handleSortChange(option.field);
                            setIsSortOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-colors ${
                            sort.field === option.field
                              ? 'bg-[#1C1A18] text-[#A855F7] font-bold'
                              : 'text-[#F5F2ED] hover:bg-[#1C1A18] font-semibold'
                          }`}
                        >
                          <span>{option.label}</span>
                          {sort.field === option.field && (
                            sort.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterOpen(!isFilterOpen);
                    setIsSortOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-[#161412] border border-[#1C1A18] hover:border-[#34322F] text-[#F5F2ED] rounded-xl transition-colors font-satoshi"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {((filter.status?.length || 0) + (filter.labels?.length || 0)) > 0 && (
                    <span className="ml-1 w-4.5 h-4.5 rounded-full bg-[#A855F7] text-[#0A0908] text-[10px] flex items-center justify-center font-black font-mono">
                      {(filter.status?.length || 0) + (filter.labels?.length || 0)}
                    </span>
                  )}
                </button>
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsFilterOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#161412] border border-[#1C1A18] shadow-2xl p-4 z-50 font-satoshi text-left">
                      <div className="px-2 mb-2 text-[10px] font-extrabold text-[#9B9691] tracking-wider uppercase font-clash">
                        STATUS FILTERS
                      </div>
                      {statusFilters.map((item) => (
                        <button
                          key={item.status}
                          type="button"
                          onClick={() => handleStatusFilterToggle(item.status)}
                          className="w-full flex items-center justify-between px-2.5 py-2.5 mb-1 text-sm rounded-xl text-[#F5F2ED] hover:bg-[#1C1A18] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                          </div>
                          {filter.status?.includes(item.status) && (
                            <CheckCircle2 className="h-4.5 w-4.5 text-[#A855F7]" />
                          )}
                        </button>
                      ))}
                      <div className="my-2 border-t border-[#1C1A18]" />
                      <button
                        type="button"
                        onClick={() => setFilter({ ...filter, showCompleted: !filter.showCompleted })}
                        className="w-full flex items-center justify-between px-2.5 py-2.5 text-sm rounded-xl text-[#F5F2ED] hover:bg-[#1C1A18] transition-colors"
                      >
                        <span>Include Completed</span>
                        {filter.showCompleted && <CheckCircle2 className="h-4.5 w-4.5 text-[#A855F7]" />}
                      </button>
                      <div className="my-2 border-t border-[#1C1A18]" />
                      <button
                        type="button"
                        onClick={() => {
                          setFilter({ showCompleted: true, showArchived: false });
                          setIsFilterOpen(false);
                        }}
                        className="w-full text-center px-2.5 py-2.5 text-sm rounded-xl text-[#EF4444] font-bold hover:bg-red-500/5 transition-colors"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Add Task Button (Desktop) */}
            <button
              type="button"
              onClick={() => setTaskDialogOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 bg-[#A855F7] text-[#0A0908] font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(168,85,247,0.2)] hover:bg-[#9333EA] hover:shadow-[0_6px_16px_rgba(168,85,247,0.3)] font-satoshi"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Grid Content */}
        <div className="min-h-[60vh]">
          {/* Task List View */}
          {viewMode === 'list' && (
            <div>
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
                    onClick={() => setTaskDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[#1C1A18] hover:border-[#34322F] text-[#F5F2ED] font-bold rounded-xl hover:bg-[#161412] transition-colors font-satoshi text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Your First Goal</span>
                  </button>
                </div>
              ) : (
                tasks.map((task) => <TaskItem key={task.id} task={task} />)
              )}
            </div>
          )}

          {/* Board View (Kanban) */}
          {viewMode === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[400px]">
              {(['todo', 'in-progress', 'blocked', 'done'] as const).map((status) => (
                <div
                  key={status}
                  className="bg-[#161412] rounded-[24px] p-5 min-h-[450px] border border-[#1C1A18] shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9)]"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                        style={{ 
                          color: statusFilters.find((s) => s.status === status)?.color || '#9E9E9E',
                          backgroundColor: statusFilters.find((s) => s.status === status)?.color || '#9E9E9E' 
                        }}
                      />
                      <span className="font-clash font-extrabold text-[#F5F2ED] text-sm">
                        {statusFilters.find((s) => s.status === status)?.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTaskDialogOpen(true)}
                      className="text-[#9B9691] hover:text-[#F5F2ED] transition-colors p-1"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {groupedTasks[status].map((task) => (
                      <TaskItem key={task.id} task={task} compact />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Calendar View Placeholder */}
          {viewMode === 'calendar' && (
            <div className="text-center py-24 text-[#9B9691] bg-[#161412] rounded-[24px] border border-dashed border-[#1C1A18]">
              <div className="mb-4 opacity-30 flex justify-center">
                <Calendar className="h-20 w-20 text-[#A855F7]" />
              </div>
              <h3 className="font-clash font-extrabold text-[#F5F2ED] text-xl tracking-tight mb-2">
                Time Dimension
              </h3>
              <p className="max-w-xs mx-auto text-sm text-[#9B9691] font-satoshi leading-relaxed">
                The visual calendar interface is currently being optimized for the Kylrix ecosystem.
              </p>
            </div>
          )}
        </div>
      </MultiSectionContainer>
    </div>
  );
}
