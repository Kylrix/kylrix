"use client";

import { createTotpSecret, updateTotpSecret } from '@/lib/appwrite';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CdrProcessingDrawer } from '@/src/features/story-cdr/CdrProcessingDrawer';

export default function NewTotpDialog({
  open,
  onClose,
  initialData,
}: {
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
  const [form, setForm] = useState({
    issuer: "",
    accountName: "",
    secretKey: "",
    folderId: "",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cdrProcessingOpen, setCdrProcessingOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    if (!open || !user?.$id) return;
    const fetchWallet = async () => {
      try {
        const { getStorySignerAndClient } = await import('@/src/features/story-cdr/wallet-bridge');
        const { account } = await getStorySignerAndClient(user.$id);
        setWalletAddress(account.address);
      } catch (err) {
        console.warn('Failed to derive wallet address for Story CDR:', err);
        setWalletAddress('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
      }
    };
    fetchWallet();
  }, [open, user?.$id]);

  useEffect(() => {
    if (initialData) {
      setForm({
        issuer: initialData.issuer || "",
        accountName: initialData.accountName || "",
        secretKey: initialData.secretKey || "",
        folderId: initialData.folderId || "",
        algorithm: initialData.algorithm || "SHA1",
        digits: initialData.digits || 6,
        period: initialData.period || 30,
      });
    } else {
      setForm({
        issuer: "",
        accountName: "",
        secretKey: "",
        folderId: "",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!user) throw new Error("Not authenticated");
      const cdrActive = !!(user?.prefs as any)?.cdr_enabled;

      if (cdrActive) {
        setCdrProcessingOpen(true);
        try {
          if (initialData && initialData.$id) {
            await updateTotpSecret(initialData.$id, {
              ...form,
              updatedAt: new Date().toISOString(),
            });
            toast.success("Smart Code updated!");
          } else {
            await createTotpSecret({
              userId: user.$id,
              ...form,
              url: null,
              tags: null,
              isFavorite: false,
              isDeleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            toast.success("Smart Code added!");
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          toast.error(
            err.message || `Failed to ${initialData ? "update" : "add"} Smart Code.`,
          );
          setCdrProcessingOpen(false);
          setLoading(false);
        }
      } else {
        if (initialData && initialData.$id) {
          await updateTotpSecret(initialData.$id, {
            ...form,
            updatedAt: new Date().toISOString(),
          });
          toast.success("Smart Code updated!");
        } else {
          await createTotpSecret({
            userId: user.$id,
            ...form,
            url: null,
            tags: null,
            isFavorite: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          toast.success("Smart Code added!");
        }
        onClose();
        setLoading(false);
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(
        err.message || `Failed to ${initialData ? "update" : "add"} Smart Code.`,
      );
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Dialog box */}
      <div 
        className="relative z-10 w-full max-w-[450px] bg-[#161412] border border-[#1C1A18] rounded-[28px] shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="pt-8 px-8 pb-4 text-2xl font-black text-white font-clash leading-none tracking-tight">
            {initialData ? "Edit" : "Add"} Smart Code
          </div>
          
          {/* Content */}
          <div className="px-8 py-4 flex flex-col gap-5">
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
                className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all"
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
                className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all"
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
                className="w-full bg-[#0A0908] text-white placeholder-white/20 border border-[#1C1A18] hover:border-white/20 focus:border-[#10B981] rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all"
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
              <div className="grid grid-cols-2 gap-4">
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
          <div className="p-8 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-extrabold text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-2xl font-extrabold bg-[#10B981] hover:bg-[#059669] text-black disabled:bg-[#10B981]/30 disabled:text-black/50 disabled:pointer-events-none transition-all flex items-center justify-center text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                initialData ? "Save Changes" : "Add Smart Code"
              )}
            </button>
          </div>
        </form>
        {cdrProcessingOpen && (
          <CdrProcessingDrawer
            open={cdrProcessingOpen}
            onClose={() => {
              setCdrProcessingOpen(false);
              setLoading(false);
              onClose();
            }}
            isDemoMode={!!(user?.prefs as any)?.demo_mode}
            walletAddress={walletAddress || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'}
            onFinished={() => {}}
          />
        )}
      </div>
    </div>
  );
}
