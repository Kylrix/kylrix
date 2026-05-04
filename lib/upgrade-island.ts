import toast from 'react-hot-toast';

/**
 * Utility to trigger the upgrade UI in the Dynamic Island or show a toast
 * when a user tries to access a premium feature.
 */
export function showUpgradeIsland(feature: string) {
  toast.error(`Premium Feature: ${feature}. Please upgrade your Kylrix tier to unlock.`, {
    icon: '💎',
    duration: 5000,
    style: {
      background: '#0A0908',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      fontWeight: 700,
      fontFamily: 'var(--font-clash)',
    }
  });
  
  // In the future, this could trigger a message to the Dynamic Island via Mesh
  console.log(`[Upgrade] User attempted to use premium feature: ${feature}`);
}
