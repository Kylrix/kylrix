'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FolderKanban, LayoutGrid, Search, X } from 'lucide-react';
import { useMediaQuery } from '@/lib/mui-tailwind/material';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import type { Projects } from '@/types/appwrite';
import toast from 'react-hot-toast';

function ProjectRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-white/8 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-white/8" />
        <div className="h-2.5 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  );
}

export function TaskAddToProjectDrawer({
  isOpen,
  onClose,
  taskId,
  taskTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { setIsDrawerOpen } = useDrawerState();
  const { user } = useAuth();
  const { fetchOptimized, getCachedDataAsync } = useDataNexus();

  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const cacheKey = user?.$id ? `projects_user_${user.$id}` : null;

  const loadProjects = useCallback(async () => {
    if (!user?.$id || !cacheKey) return;

    const cached = await getCachedDataAsync<Projects[]>(cacheKey);
    if (cached?.length) {
      setProjects(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const rows = await fetchOptimized(cacheKey, async () => {
        const res = await ProjectsService.listProjects();
        return (res.rows || []) as Projects[];
      });
      setProjects(rows);
    } catch (error) {
      console.error('[TaskAddToProject] Failed to load projects', error);
      if (!cached?.length) {
        toast.error('Could not load projects');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.$id, cacheKey, fetchOptimized, getCachedDataAsync]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (isOpen) {
      void loadProjects();
    } else {
      setQuery('');
      setAddingId(null);
    }
    return () => setIsDrawerOpen(false);
  }, [isOpen, loadProjects, setIsDrawerOpen]);

  const filteredProjects = useMemo(() => {
    const eligible = projects.filter((project) => !(project as Projects & { isPending?: boolean }).isPending);
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((project) => {
      const title = (project.title || '').toLowerCase();
      const summary = (project.summary || '').toLowerCase();
      return title.includes(q) || summary.includes(q);
    });
  }, [projects, query]);

  const handleSelect = async (project: Projects) => {
    if (!taskId || addingId) return;
    setAddingId(project.$id);
    try {
      await ProjectsService.addObjectToProject(project.$id, 'goal', taskId);
      toast.success(`Added to "${project.title}"`);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add goal to project');
    } finally {
      setAddingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1200] animate-in fade-in"
        onClick={onClose}
      />

      <div
        className={`fixed bg-[#161412] border-[#34322F] shadow-2xl flex flex-col overflow-hidden z-[1201] ${
          isDesktop
            ? 'top-0 right-0 h-screen w-[480px] border-l'
            : 'bottom-0 left-0 right-0 max-h-[85dvh] h-auto border-t rounded-t-[28px] max-w-[720px] mx-auto w-full'
        }`}
      >
        {!isDesktop && (
          <div className="flex justify-center py-3 cursor-pointer select-none shrink-0" onClick={onClose}>
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
          </div>
        )}

        <div className="px-5 pt-5 pb-4 border-b border-[#1C1A18] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#6366F1] mb-1">
                <FolderKanban size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest font-mono">Add to Project</span>
              </div>
              <h3 className="font-extrabold text-lg text-white font-clash tracking-tight leading-tight">
                Choose a project
              </h3>
              <p className="text-xs text-white/45 font-medium mt-1 line-clamp-2 break-words [overflow-wrap:anywhere]">
                {taskTitle || 'This goal'} will appear in the project workspace instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5 shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-[#0A0908] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#6366F1]/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2 scrollbar-thin">
          {loading && projects.length === 0 ? (
            <>
              <ProjectRowSkeleton />
              <ProjectRowSkeleton />
              <ProjectRowSkeleton />
              <ProjectRowSkeleton />
            </>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 px-4">
              <LayoutGrid size={28} className="mx-auto text-white/15 mb-3" />
              <p className="text-sm font-bold text-white/50">
                {query.trim() ? 'No projects match your search' : 'No projects available yet'}
              </p>
              <p className="text-xs text-white/30 mt-1">
                Create a project first, then link this goal from here.
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isAdding = addingId === project.$id;
              return (
                <button
                  key={project.$id}
                  type="button"
                  disabled={Boolean(addingId)}
                  onClick={() => void handleSelect(project)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-white/6 bg-white/[0.02] hover:bg-[#6366F1]/8 hover:border-[#6366F1]/25 transition-all text-left disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/12 border border-[#6366F1]/20 grid place-items-center shrink-0">
                    <LayoutGrid size={18} className="text-[#818CF8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{project.title}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mt-0.5">
                      {project.status || 'active'} · {project.visibility || 'private'}
                    </p>
                  </div>
                  {isAdding ? (
                    <div className="w-4 h-4 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <ArrowLeft size={14} className="text-white/20 rotate-180 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export function TaskAddToProjectDrawerHost() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const isOpen = activeContent === 'task-add-to-project';

  return (
    <TaskAddToProjectDrawer
      isOpen={isOpen}
      onClose={close}
      taskId={drawerData?.taskId || drawerData?.resourceId || ''}
      taskTitle={drawerData?.taskTitle || drawerData?.resourceTitle || ''}
    />
  );
}
