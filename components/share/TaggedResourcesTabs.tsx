'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, CheckSquare, Lock, ShieldCheck, FileSpreadsheet, Calendar, Tag, Camera, PhoneCall, FolderKanban, ExternalLink, Trash2 
} from 'lucide-react';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import NewTotpDialog from '@/components/app/totp/new';
import FormDialog from '@/components/forms/FormDialog';

export function ResourceItem({ 
    id,
    title, 
    kind, 
    metadata, 
    onOpen, 
    onUnlink,
    keepPermission,
    onToggleKeepPermission,
    projectId
}: { 
    id: string,
    title: string, 
    kind: string, 
    metadata: string, 
    onOpen: () => void, 
    onUnlink: () => void,
    onExtractGoals?: () => void,
    keepPermission?: boolean | null,
    onToggleKeepPermission?: (checked: boolean) => void,
    projectId?: string
}) {
    const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | null>(null);
    const longPressTimerRef = useRef<any>(null);
    const touchStartPosRef = useRef<{ x: number, y: number } | null>(null);

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!onToggleKeepPermission) return;
        event.preventDefault();
        setMenuAnchor({ x: event.clientX, y: event.clientY });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!onToggleKeepPermission) return;
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        const currentTarget = e.currentTarget;
        longPressTimerRef.current = setTimeout(() => {
            const rect = currentTarget.getBoundingClientRect();
            setMenuAnchor({ x: rect.left + rect.width / 2, y: rect.bottom });
            if (navigator.vibrate) navigator.vibrate(10);
        }, 600);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const getKindAssets = (k: string) => {
        const lower = k?.toLowerCase() || '';
        switch (lower) {
            case 'note':
                return { icon: <FileText size={20} />, accent: '#EC4899' }; // Pink
            case 'goal':
                return { icon: <CheckSquare size={20} />, accent: '#A855F7' }; // Purple
            case 'secret':
            case 'password':
            case 'credential':
                return { icon: <Lock size={20} />, accent: '#10B981' }; // Emerald
            case 'totp':
                return { icon: <ShieldCheck size={20} />, accent: '#6366F1' }; // Indigo
            case 'form':
                return { icon: <FileSpreadsheet size={20} />, accent: '#3B82F6' }; // Blue
            case 'event':
                return { icon: <Calendar size={20} />, accent: '#F59E0B' }; // Amber
            case 'tag':
                return { icon: <Tag size={20} />, accent: '#06B6D4' }; // Cyan
            case 'moment':
                return { icon: <Camera size={20} />, accent: '#E11D48' }; // Rose
            case 'call':
                return { icon: <PhoneCall size={20} />, accent: '#EF4444' }; // Red
            default:
                return { icon: <FolderKanban size={20} />, accent: '#818CF8' }; // Default Violet
        }
    };

    const { icon, accent } = getKindAssets(kind);

    return (
        <>
            <div
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:py-6 md:px-7 gap-4 rounded-[24px] bg-[#13110F] border border-white/6 hover:border-white/12 hover:bg-[#181613] transition-all duration-300 ease-out select-none max-w-full overflow-hidden group"
                style={{
                    cursor: onToggleKeepPermission ? 'context-menu' : 'default'
                }}
            >
                {/* Accent border left */}
                <div 
                    className="absolute top-0 left-0 w-1 h-full opacity-60 group-hover:opacity-100 transition-opacity" 
                    style={{ backgroundColor: accent }} 
                />

                <div className="flex items-center gap-4 min-w-0 flex-1 w-full sm:w-auto">
                    <div 
                        className="w-11 h-11 rounded-[14px] flex items-center justify-center border transition-all duration-300 flex-shrink-0"
                        style={{ 
                            backgroundColor: `${accent}14`,
                            color: accent,
                            borderColor: `${accent}26`
                        }}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-extrabold text-sm md:text-base leading-snug truncate">
                                {title}
                            </span>
                            {keepPermission && (
                                <span className="inline-flex text-[#10B981] flex-shrink-0" title="Keeps original permissions (override active)">
                                    <ShieldCheck size={16} />
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] text-white/40 font-black uppercase tracking-wider bg-white/3 px-2 py-0.5 rounded border border-white/5 inline-flex items-center">
                                {metadata || kind}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-shrink-0 border-t border-white/4 md:border-t-0 pt-3 md:pt-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpen(); }}
                        className="inline-flex items-center gap-1 text-white/70 hover:text-white bg-white/2 hover:bg-white/5 border border-white/6 hover:border-white/12 font-extrabold text-xs px-3.5 py-1.5 rounded-[10px] transition-all"
                    >
                        <ExternalLink size={12} />
                        <span>Open</span>
                    </button>

                    <div className="bg-white/3 rounded-[10px] border border-white/6 p-0.5 flex items-center">
                        <ShareLockButton 
                            resourceType={kind === 'goal' ? 'goal' : kind as any}
                            resourceId={id}
                            isPublic={false} 
                            isGuest={false}
                            accentColor={accent}
                            projectId={projectId}
                            onPublished={() => {}}
                        />
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); onUnlink(); }}
                        className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white/20 hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-all"
                        title="Unlink"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {menuAnchor && (
                <>
                    <div className="fixed inset-0 z-50 cursor-default" onClick={() => setMenuAnchor(null)} />
                    <div 
                        className="fixed z-[100] bg-[#161412] border border-white/8 rounded-[16px] min-w-[240px] shadow-2xl p-4 flex flex-col gap-2 cursor-default select-none"
                        style={{ top: menuAnchor.y, left: menuAnchor.x }}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-white text-xs font-black">
                                Keep Original Permissions
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    onToggleKeepPermission?.(!keepPermission);
                                    setMenuAnchor(null);
                                }}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    keepPermission ? 'bg-[#6366F1]' : 'bg-white/10'
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        keepPermission ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                        <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                            When enabled, this object uses its own permissions instead of inheriting the project&apos;s.
                        </p>
                    </div>
                </>
            )}
        </>
    );
}

export function TaggedResourcesTabs({ 
  resources, 
  openSidebar, 
  openSecondarySidebar, 
  openOverlay, 
  closeOverlay, 
  fetchProjectData,
  handleToggleKeepPermission,
  router,
  showError,
  projectId
}: { 
  resources: any, 
  openSidebar: any,
  openSecondarySidebar: any,
  openOverlay: any,
  closeOverlay: any,
  fetchProjectData: () => Promise<void>,
  handleToggleKeepPermission?: any,
  handleRemoveObject: any,
  router: any,
  showError: (title: string, msg: string) => void,
  projectId?: string
}) {
  const TAGGED_TABS = [
    { label: 'Notes', icon: <FileText size={16} />, count: resources.notes?.length || 0 },
    { label: 'Tasks', icon: <CheckSquare size={16} />, count: resources.tasks?.length || 0 },
    { label: 'Vault', icon: <Lock size={16} />, count: (resources.credentials?.length || 0) + (resources.totps?.length || 0) },
    { label: 'Flow', icon: <FileSpreadsheet size={16} />, count: (resources.forms?.length || 0) + (resources.moments?.length || 0) + (resources.events?.length || 0) },
  ];

  const visibleTabs = TAGGED_TABS.filter(t => t.count > 0);
  
  const [localTabValue, setLocalTabValue] = useState(0);
  
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs[localTabValue]) {
      setLocalTabValue(0);
    }
  }, [visibleTabs, localTabValue]);

  if (visibleTabs.length === 0) return null;

  const currentTabLabel = visibleTabs[localTabValue]?.label;

  const handleUnlinkTagged = (title: string) => {
    showError('Cannot unlink tagged resource', `"${title}" is automatically included because it shares tags with this context. To remove it, you must remove the tags from the item itself.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
        {visibleTabs.map((tab, idx) => (
          <button
            key={tab.label}
            onClick={() => setLocalTabValue(idx)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap ${
              localTabValue === idx 
                ? 'bg-[#6366F1] text-black shadow-[0_4px_12px_rgba(99,102,241,0.3)]' 
                : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/8'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              localTabValue === idx ? 'bg-black/20' : 'bg-white/10'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {currentTabLabel === 'Notes' && resources.notes?.map((note: any) => (
          <ResourceItem 
            key={note.$id}
            id={note.$id}
            projectId={projectId}
            title={note.title || 'Untitled Note'} 
            kind="note"
            metadata={note.tags?.slice(0, 3).join(' • ') || 'Auto-swept'}
            onOpen={() => openSidebar(
              <NoteDetailSidebar 
                note={note} 
                onUpdate={fetchProjectData} 
                onDelete={fetchProjectData} 
              />, 
              'note-detail',
              { hideHeader: true }
            )}
            onUnlink={() => handleUnlinkTagged(note.title || 'Untitled Note')}
            keepPermission={note.keepPermission ?? true}
            onToggleKeepPermission={handleToggleKeepPermission ? (checked) => handleToggleKeepPermission(note.$id, 'note', checked) : undefined}
          />
        ))}

        {currentTabLabel === 'Tasks' && resources.tasks?.map((task: any) => (
          <ResourceItem 
            key={task.$id}
            id={task.$id}
            projectId={projectId}
            title={task.title} 
            kind="goal"
            metadata={`${task.status.replace('-', ' ')} • ${task.priority}`}
            onOpen={() => openSecondarySidebar('task', task.$id)}
            onUnlink={() => handleUnlinkTagged(task.title)}
            keepPermission={task.keepPermission ?? true}
            onToggleKeepPermission={handleToggleKeepPermission ? (checked) => handleToggleKeepPermission(task.$id, 'goal', checked) : undefined}
          />
        ))}

        {currentTabLabel === 'Vault' && (
          <>
            {resources.credentials?.map((cred: any) => (
              <ResourceItem 
                key={cred.$id}
                id={cred.$id}
                projectId={projectId}
                title={cred.name} 
                kind="password"
                metadata={cred.username || 'Shared secret'}
                onOpen={() => openOverlay(
                  <CredentialDialog 
                    open={true} 
                    onClose={closeOverlay} 
                    initial={cred} 
                    onSaved={fetchProjectData} 
                  />
                )}
                onUnlink={() => handleUnlinkTagged(cred.name)}
                keepPermission={cred.keepPermission ?? true}
                onToggleKeepPermission={handleToggleKeepPermission ? (checked) => handleToggleKeepPermission(cred.$id, 'password', checked) : undefined}
              />
            ))}
            {resources.totps?.map((totp: any) => (
              <ResourceItem 
                key={totp.$id}
                id={totp.$id}
                projectId={projectId}
                title={totp.issuer || totp.name || 'Smart Code'} 
                kind="totp"
                metadata={totp.accountName || 'TOTP secret'}
                onOpen={() => openOverlay(
                  <NewTotpDialog 
                    open={true} 
                    onClose={() => {
                      closeOverlay();
                      fetchProjectData();
                    }} 
                    initialData={totp} 
                  />
                )}
                onUnlink={() => handleUnlinkTagged(totp.issuer || totp.name || 'Smart Code')}
                keepPermission={totp.keepPermission ?? true}
                onToggleKeepPermission={handleToggleKeepPermission ? (checked) => handleToggleKeepPermission(totp.$id, 'totp', checked) : undefined}
              />
            ))}
          </>
        )}

        {currentTabLabel === 'Flow' && (
          <>
            {resources.forms?.map((form: any) => (
              <ResourceItem 
                key={form.$id}
                id={form.$id}
                projectId={projectId}
                title={form.title || 'Untitled Form'} 
                kind="form"
                metadata={form.description || 'Interactive Flow Schema'}
                onOpen={() => openOverlay(
                  <FormDialog 
                    open={true} 
                    onClose={closeOverlay} 
                    form={form} 
                    onSaved={fetchProjectData} 
                  />
                )}
                onUnlink={() => handleUnlinkTagged(form.title || 'Untitled Form')}
              />
            ))}
            {resources.events?.map((event: any) => (
              <ResourceItem 
                key={event.$id}
                id={event.$id}
                projectId={projectId}
                title={event.title} 
                kind="event"
                metadata={`${event.location || 'No location'} • ${new Date(event.startTime).toLocaleString()}`}
                onOpen={() => openSecondarySidebar('event', event.$id, event)}
                onUnlink={() => handleUnlinkTagged(event.title)}
                keepPermission={event.keepPermission ?? true}
                onToggleKeepPermission={handleToggleKeepPermission ? (checked) => handleToggleKeepPermission(event.$id, 'event', checked) : undefined}
              />
            ))}
            {resources.moments?.map((moment: any) => (
              <ResourceItem 
                key={moment.$id}
                id={moment.$id}
                projectId={projectId}
                title={moment.caption || 'Integrated Moment'} 
                kind="moment"
                metadata={`Published: ${new Date(moment.$createdAt || moment.createdAt).toLocaleDateString()}`}
                onOpen={() => router.push(`/moment/${moment.$id}`)}
                onUnlink={() => handleUnlinkTagged(moment.caption || 'Integrated Moment')}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
