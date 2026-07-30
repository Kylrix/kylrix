'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, ShieldCheck, Ban, Copy, Check } from 'lucide-react';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { useToast } from '@/hooks/useToast';
import { buildPublicResourceUrl } from '@/lib/share/public-url';

interface AccessControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: any;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  resourceTitle: string;
  projectId?: string;
  onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void;
}

export function AccessControlDrawer({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  isPublic: initialIsPublic,
  isGuest: initialIsGuest,
  resourceTitle,
  projectId,
  onUpdate
}: AccessControlDrawerProps) {
  const { setIsDrawerOpen } = useDrawerState();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [localIsPublic, setLocalIsPublic] = useState(initialIsPublic);
  const [localIsGuest, setLocalIsGuest] = useState(initialIsGuest);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  useEffect(() => {
    setLocalIsPublic(initialIsPublic);
    setLocalIsGuest(initialIsGuest);
  }, [initialIsPublic, initialIsGuest]);

  const handleCopyLink = async () => {
    try {
      const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      showSuccess('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (_err: unknown) {
      showError('Could not copy link');
    }
  };

  const handleTogglePublic = async (enable: boolean) => {
    setLoading(true);
    try {
      const res = await toggleResourcePublicGuest({
        resourceType,
        resourceId,
        mode: enable ? 'publish' : 'make_private',
        projectId
      });
      if (res.success) {
        showSuccess(enable ? 'Public access enabled' : 'Public access disabled');
        const nextPublic = enable;
        const nextGuest = enable ? localIsGuest : false;
        setLocalIsPublic(nextPublic);
        setLocalIsGuest(nextGuest);
        onUpdate?.({ isPublic: nextPublic, isGuest: nextGuest });
        onClose();
      }
    } catch (err: any) {
      showError('Failed to update public access: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGuest = async (enable: boolean) => {
    if (!localIsPublic && enable) return;
    setLoading(true);
    try {
      const res = await toggleResourcePublicGuest({
        resourceType,
        resourceId,
        mode: enable ? 'guest_on' : 'guest_off',
        projectId
      });
      if (res.success) {
        showSuccess(enable ? 'Guest access enabled' : 'Guest access disabled');
        setLocalIsGuest(enable);
        onUpdate?.({ isPublic: localIsPublic, isGuest: enable });
        onClose();
      }
    } catch (err: any) {
      showError('Failed to update guest access: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isActive = localIsPublic || localIsGuest;

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ease-in-out cursor-default"
        onClick={onClose}
      />
      
      {/* 2. Slide-up Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] md:max-h-[60vh] bg-[#161412] border-t border-white/8 rounded-t-[28px] z-[100] text-white p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/12 rounded-[2px] mx-auto mb-2 flex-shrink-0" />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight leading-tight font-clash">
              {isActive ? 'Stop Sharing' : 'Share'}
            </h3>
            <p className="text-white/40 text-[11px] font-bold mt-1">
              Configure visibility settings for &quot;{resourceTitle}&quot;
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Access controls */}
        <div className="flex flex-col gap-4">
          {/* Public Link Copy Button if shared */}
          {isActive && (
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-between w-full p-3 bg-white/3 hover:bg-white/6 border border-white/6 rounded-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-[#10B981]" />
                <span className="text-xs font-bold text-white/85">Copy public sharing link</span>
              </div>
              {copied ? <Check size={16} className="text-[#10B981]" /> : <Copy size={16} className="text-white/40" />}
            </button>
          )}

          {/* Public Access Panel */}
          <div 
            onClick={() => !loading && handleTogglePublic(!localIsPublic)}
            className="flex items-center justify-between p-4 bg-white/2 hover:bg-white/4 border border-white/5 rounded-2xl cursor-pointer transition-all select-none"
          >
            <div className="flex items-center gap-3">
              <Globe size={20} className={localIsPublic ? 'text-[#10B981]' : 'text-white/20'} />
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-white font-satoshi">Public Access</span>
                <span className="text-[11px] text-white/40 font-semibold font-satoshi mt-0.5">Anyone with the link can view this.</span>
              </div>
            </div>
            <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
              localIsPublic ? 'bg-[#10B981]' : 'bg-white/10'
            }`}>
              <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 ${
                localIsPublic ? 'translate-x-3' : 'translate-x-0'
              }`} />
            </div>
          </div>

          {/* Guest Access Panel */}
          <div 
            onClick={() => !loading && localIsPublic && handleToggleGuest(!localIsGuest)}
            className={`flex items-center justify-between p-4 bg-white/2 hover:bg-white/4 border border-white/5 rounded-2xl transition-all select-none ${
              !localIsPublic ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className={localIsGuest && localIsPublic ? 'text-[#10B981]' : 'text-white/20'} />
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-white font-satoshi">Guest Access</span>
                <span className="text-[11px] text-white/40 font-semibold font-satoshi mt-0.5">Allows anonymous visitors guest interaction rights.</span>
              </div>
            </div>
            <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
              localIsGuest && localIsPublic ? 'bg-[#10B981]' : 'bg-white/10'
            }`}>
              <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 ${
                localIsGuest && localIsPublic ? 'translate-x-3' : 'translate-x-0'
              }`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
