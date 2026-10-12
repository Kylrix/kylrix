import React from 'react';
import toast from 'react-hot-toast';
import { sanitizeInAppHref } from '@/lib/routing/app-paths';
import type { KylrixNotification } from '@/components/layout/NotificationDrawer';

export interface NotificationResolverContext {
  workspaces?: any[];
  setActiveWorkspaceId?: (id: string) => void;
  notes?: any[];
  tasks?: any[];
  selectTask?: (id: string) => void;
  events?: any[];
  openSidebar?: (content: React.ReactNode, id?: string, options?: any) => void;
  closeSidebar?: () => void;
  openOverlay?: (content: React.ReactNode) => void;
  closeOverlay?: () => void;
  setActiveDetail?: (detail: any) => void;
  openUnified?: (type: any, payload?: any) => void;
  router?: { push: (href: string) => void };
}

export function executeNotificationAction(
  notif: KylrixNotification,
  ctx: NotificationResolverContext
): { handled: boolean; type: string } {
  const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
  const rawHref = notif.actionHref ? sanitizeInAppHref(notif.actionHref) : '';

  // 1. Follow / Profile notification category
  if (notif.category === 'follows' && notif.actor) {
    if (ctx.openUnified) {
      ctx.openUnified('profile-preview', {
        userId: notif.actor.userId,
        username: notif.actor.username || notif.actor.name,
        name: notif.actor.name,
        avatar: notif.actor.avatar,
        npub: notif.actor.npub,
        pubkey: notif.actor.pubkey,
        source: 'ecosystem',
      });
      return { handled: true, type: 'profile' };
    }
  }

  if (!rawHref) {
    return { handled: false, type: 'none' };
  }

  let cleanPath = rawHref;
  try {
    if (/^https?:\/\//i.test(rawHref)) {
      cleanPath = new URL(rawHref).pathname;
    } else {
      const q = rawHref.indexOf('?');
      if (q >= 0) cleanPath = rawHref.slice(0, q);
    }
  } catch {}

  const parts = cleanPath.split('/').filter(Boolean);
  const routePrefix = parts[0] || '';
  const targetId = parts[1] || '';

  // 2. Check if targetId matches a known entity regardless of path prefix mislabeling
  const knownWorkspace = targetId
    ? ctx.workspaces?.find((w) => (w.id || w.$id) === targetId)
    : undefined;
  const knownNote = targetId
    ? ctx.notes?.find((n) => (n.id || n.$id) === targetId)
    : undefined;
  const knownTask = targetId
    ? ctx.tasks?.find((t) => (t.id || t.$id) === targetId)
    : undefined;
  const knownEvent = targetId
    ? ctx.events?.find((e) => (e.id || e.$id) === targetId)
    : undefined;

  // A) Workspace activation (if path starts with workspace/project OR if ID is a known workspace)
  if (
    knownWorkspace ||
    routePrefix === 'workspace' ||
    routePrefix === 'workspaces' ||
    routePrefix === 'projects' ||
    routePrefix === 'project'
  ) {
    const wsId = knownWorkspace?.id || knownWorkspace?.$id || targetId;
    if (wsId && ctx.setActiveWorkspaceId) {
      ctx.setActiveWorkspaceId(wsId);
      const title = knownWorkspace?.title || 'Workspace';
      toast.success(`Active workspace: ${title}`);
      return { handled: true, type: 'workspace' };
    }
  }

  // B) Note / Idea activation (if path starts with idea/note OR if ID is a known note)
  if (knownNote || routePrefix === 'idea' || routePrefix === 'notes' || routePrefix === 'note') {
    const noteId = knownNote?.id || knownNote?.$id || targetId;
    if (noteId) {
      const noteItem = knownNote || { id: noteId, title: notif.title, content: notif.message };
      if (ctx.setActiveDetail) {
        ctx.setActiveDetail({ type: 'note', id: noteId, data: noteItem });
      }
      try {
        const NoteDetailSidebarComp = require('@/components/ui/NoteDetailSidebar').NoteDetailSidebar;
        if (isWide && ctx.openSidebar && ctx.closeSidebar) {
          ctx.openSidebar(
            <NoteDetailSidebarComp note={noteItem} onClose={ctx.closeSidebar} />,
            noteId,
            { hideHeader: true }
          );
        } else if (ctx.openOverlay && ctx.closeOverlay) {
          ctx.openOverlay(
            <NoteDetailSidebarComp note={noteItem} onClose={ctx.closeOverlay} />
          );
        }
      } catch {}
      return { handled: true, type: 'note' };
    }
  }

  // C) Goal / Task activation (if path starts with goal/goals OR if ID is a known task)
  if (knownTask || routePrefix === 'goal' || routePrefix === 'goals') {
    const taskId = knownTask?.id || knownTask?.$id || targetId;
    if (taskId) {
      if (ctx.selectTask) {
        ctx.selectTask(taskId);
      }
      try {
        const GoalObjectDetailComp = require('@/components/objects/GoalObjectDetail').GoalObjectDetail;
        if (isWide && ctx.openSidebar && ctx.closeSidebar) {
          ctx.openSidebar(
            <GoalObjectDetailComp taskId={taskId} embedded onClose={ctx.closeSidebar} />,
            taskId,
            { hideHeader: true }
          );
        } else if (ctx.openOverlay && ctx.closeOverlay) {
          ctx.openOverlay(
            <GoalObjectDetailComp taskId={taskId} onClose={ctx.closeOverlay} embedded />
          );
        }
      } catch {}
      return { handled: true, type: 'goal' };
    }
  }

  // C2) Form activation (if path starts with form/forms)
  if (routePrefix === 'form' || routePrefix === 'forms') {
    const formId = targetId;
    if (formId) {
      let overlayOpened = false;
      try {
        const FormDetailComp = require('@/components/forms/FormDetail').FormDetail;
        if (isWide && ctx.openSidebar && ctx.closeSidebar) {
          ctx.openSidebar(
            <FormDetailComp formId={formId} embedded onClose={ctx.closeSidebar} />,
            `form_${formId}`,
            { hideHeader: true }
          );
          overlayOpened = true;
        } else if (ctx.openOverlay && ctx.closeOverlay) {
          ctx.openOverlay(
            <FormDetailComp formId={formId} embedded onClose={ctx.closeOverlay} />
          );
          overlayOpened = true;
        }
      } catch {}

      if (!overlayOpened && ctx.router) {
        ctx.router.push(`/form/${formId}`);
      }
      return { handled: true, type: 'form' };
    }
  }

  // D) Event activation (if path starts with event/events OR if ID is a known event)
  if (knownEvent || routePrefix === 'event' || routePrefix === 'events') {
    const eventId = knownEvent?.id || knownEvent?.$id || targetId;
    if (eventId) {
      let overlayOpened = false;
      try {
        const EventDetailsComp = require('@/components/events/EventDetails').default;
        if (isWide && ctx.openSidebar && ctx.closeSidebar) {
          ctx.openSidebar(
            <EventDetailsComp eventId={eventId} initialData={knownEvent} onClose={ctx.closeSidebar} onBack={ctx.closeSidebar} />,
            eventId,
            { hideHeader: true }
          );
          overlayOpened = true;
        } else if (ctx.openOverlay && ctx.closeOverlay) {
          ctx.openOverlay(
            <EventDetailsComp eventId={eventId} initialData={knownEvent} onClose={ctx.closeOverlay} onBack={ctx.closeOverlay} />
          );
          overlayOpened = true;
        }
      } catch {}

      if (!overlayOpened && ctx.router) {
        ctx.router.push(`/events/${eventId}`);
      }
      return { handled: true, type: 'event' };
    }
  }

  // E) Tags
  if (routePrefix === 'tags') {
    if (ctx.openUnified) {
      ctx.openUnified('tags', { tagId: targetId });
      return { handled: true, type: 'tag' };
    }
  }

  // F) Trash
  if (routePrefix === 'trash') {
    if (ctx.openUnified) {
      ctx.openUnified('trash');
      return { handled: true, type: 'trash' };
    }
  }

  // G) Fallback: Standard in-app route navigation if path is not an object detail route
  if (ctx.router && cleanPath && cleanPath !== '/app') {
    ctx.router.push(cleanPath);
    return { handled: true, type: 'route' };
  }

  return { handled: false, type: 'none' };
}
