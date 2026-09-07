'use client';

/**
 * @deprecated Use EcosystemPorter via useOpenEcosystemPorter().
 * Kept as a thin adapter for any lingering drawer mounts.
 */
import EcosystemPorter from '@/components/porter/EcosystemPorter';

interface VaultPorterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VaultPorterDrawer({ isOpen, onClose }: VaultPorterDrawerProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[14000] flex pointer-events-auto overflow-hidden">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative z-[14001] ml-auto h-[100dvh] w-full max-w-[560px] bg-[#161412] border-l border-white/20">
        <EcosystemPorter embedded onClose={onClose} />
      </div>
    </div>
  );
}
