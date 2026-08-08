"use client";

import { createTotpSecret, updateTotpSecret } from '@/lib/appwrite';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Drawer, Box, IconButton } from '@/lib/openbricks/primitives';
import { X, Shield } from 'lucide-react';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useSudo } from '@/context/SudoContext';
import { masterPassCrypto } from '@/lib/masterpass-crypto';

import { useWorkspace } from '@/context/WorkspaceContext';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';

const DRAWER_SX_MOBILE = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#0A0908',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  backgroundImage: 'none',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DRAWER_SX_DESKTOP = {
  bgcolor: '#0A0908',
  borderLeft: '1px solid rgba(255,255,255,0.05)',
  backgroundImage: 'none',
  width: 600,
  maxWidth: '100%',
  height: '100dvh'};

export default function NewTotpDialog({
  open,
  onClose,
  initialData}: {
  open: boolean;
  onClose: () => void;
  initialData?: {
    $id?: string;
    issuer?: string | null;
    accountName?: string | null;
    secretKey?: string;
    period?: number | null;
    digits?: number | null;
    algorithm?: string | null;
    folderId?: string | null;
  };
}) {
  const { user } = useAppwriteVault();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { setIsDrawerOpen } = useDrawerState();
  const { requestSudo } = useSudo();
  
  const [form, setForm] = useState({
    issuer: "",
    accountName: "",
    secretKey: "",
    folderId: "",
    algorithm: "SHA1",
    digits: 6,
    period: 30});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsDrawerOpen(open);
    return () => setIsDrawerOpen(false);
  }, [open, setIsDrawerOpen]);

  useEffect(() => {
    if (initialData) {
      setForm({
        issuer: initialData.issuer || "",
        accountName: initialData.accountName || "",
        secretKey: initialData.secretKey || "",
        folderId: initialData.folderId || "",
        algorithm: initialData.algorithm || "SHA1",
        digits: initialData.digits || 6,
        period: initialData.period || 30});
    } else {
      setForm({
        issuer: "",
        accountName: "",
        secretKey: "",
        folderId: "",
        algorithm: "SHA1",
        digits: 6,
        period: 30});
    }
  }, [initialData, open]);

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
    onClose();
  }, [onClose, setIsDrawerOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!masterPassCrypto.isVaultUnlocked()) {
      requestSudo({
        onSuccess: () => {
          const fake = { preventDefault() {} } as React.FormEvent;
          void handleSubmit(fake);
        },
      });
      return;
    }

    setLoading(true);
    try {
      if (!user) throw new Error("Not authenticated");

      const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);

      if (initialData && initialData.$id) {
        await updateTotpSecret(initialData.$id, {
          ...form,
          updatedAt: new Date().toISOString()});
        toast.success("Smart Code updated!");
      } else {
        const created = await createTotpSecret({
          userId: user.$id,
          ...form,
          url: null,
          tags: null,
          isWorkspace: isCustomWorkspace,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()} as any);

        if (isCustomWorkspace && (created?.$id || (created as any)?.id)) {
          void attachEntityToActiveWorkspace('totp', created.$id || (created as any).id);
        }
        toast.success("Smart Code added!");
      }
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(
        err.message || `Failed to ${initialData ? "update" : "add"} Smart Code.`);
      setLoading(false);
    }
  };

  const totpForm = (
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 pb-6 select-none h-full overflow-y-auto pt-2">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1A18]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black font-clash text-white">{initialData ? "Edit" : "Add"} Smart Code</h2>
              <p className="text-xs font-semibold text-white/40">Secure multi-factor authenticator</p>
            </div>
          </div>
          <IconButton onClick={handleClose} sx={{ color: '#9B9691' }}>
            <X size={20} />
          </IconButton>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5 flex-1 overflow-y-auto">
          {/* Issuer field */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.75rem] font-bold text-[#9B9691] tracking-wide uppercase">
              Issuer <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Google, GitHub"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              required
              className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3.5 text-sm focus:outline-none transition-all"
            />
          </div>

          {/* Account Name field */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.75rem] font-bold text-[#9B9691] tracking-wide uppercase">
              Account Name <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. user@example.com"
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              required
              className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3.5 text-sm focus:outline-none transition-all"
            />
          </div>

          {/* Secure Key field */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.75rem] font-bold text-[#9B9691] tracking-wide uppercase">
              Secure Key <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter the secure key"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
              required
              className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3.5 text-sm focus:outline-none transition-all"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="w-4 h-4 rounded border-[#1C1A18] text-[#10B981] focus:ring-[#10B981]/20 focus:ring-opacity-50 accent-[#10B981] cursor-pointer"
            />
            <span className="text-sm font-semibold text-white/70">
              Advanced Settings
            </span>
          </label>

          {/* Advanced Fields */}
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-bold text-[#9B9691] tracking-wide uppercase">
                  Digits
                </label>
                <input
                  type="number"
                  value={form.digits}
                  disabled
                  className="w-full bg-[#0A0908]/50 text-white/50 border border-[#1C1A18] rounded-xl px-4 py-3 text-sm focus:outline-none cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-bold text-[#9B9691] tracking-wide uppercase">
                  Period (s)
                </label>
                <input
                  type="number"
                  value={form.period}
                  disabled
                  className="w-full bg-[#0A0908]/50 text-white/50 border border-[#1C1A18] rounded-xl px-4 py-3 text-sm focus:outline-none cursor-not-allowed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 flex gap-4 mt-auto">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3.5 rounded-2xl font-extrabold text-white/50 hover:text-white hover:bg-white/5 border border-[#1C1A18] transition-all text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3.5 rounded-2xl font-extrabold bg-[#10B981] hover:bg-[#059669] text-black disabled:bg-[#10B981]/30 disabled:text-black/50 disabled:pointer-events-none transition-all flex items-center justify-center text-sm cursor-pointer shadow-[0_4px_20px_rgba(16,185,129,0.15)]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              initialData ? "Save Changes" : "Add Smart Code"
            )}
          </button>
        </div>
      </form>
  );

  if (!open) return null;

  // Desktop: true native right sidebar that pushes extended primary left sidebar (like CreateGoalComposer)
  if (!isMobile) {
    return (
      <NativeSidebarMount active={open} sidebarKey={initialData?.$id ? `edit-totp-${initialData.$id}` : "create-totp"} width={560} title={initialData ? "Edit Smart Code" : "New Smart Code"}>
        <div className="h-full bg-[#0A0908] flex flex-col overflow-hidden">
          {totpForm}
        </div>
      </NativeSidebarMount>
    );
  }

  // Mobile: bottom drawer ecosystem standard (opaque, handle, z above bottom navbar)
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          ...DRAWER_SX_MOBILE,
          height: '65dvh',
          pointerEvents: 'auto',
          zIndex: 1401}
      }}
      ModalProps={{
        keepMounted: false,
        disablePortal: true,
        sx: { zIndex: 1400 } as any}}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} />
      </Box>
      {totpForm}
    </Drawer>
  );
}
