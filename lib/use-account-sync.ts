import { useEffect } from 'react';

const BROADCAST_CHANNEL = 'id_account_switch';

export function useAccountSync(onSwitch?: (userId: string) => void) {
  useEffect(() => {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL);

    bc.onmessage = (event: MessageEvent) => {
      console.log('Account switch detected:', event.data.activeUserId);
      if (onSwitch) {
        onSwitch(event.data.activeUserId);
      }
      window.location.reload();
    };

    return () => {
      bc.close();
    };
  }, [onSwitch]);
}
