import { useEffect } from 'react';
import { Models } from 'appwrite';
import { subscribeToTable } from '../lib/kylrixflow';

export function useRealtimeTable<T extends Models.Row>(
    tableId: string,
    onEvent: (event: { type: 'create' | 'update' | 'delete', payload: T }) => void
) {
    useEffect(() => {
        let unsub: any;
        const init = async () => {
            unsub = await subscribeToTable<T>(tableId, onEvent);
        };
        init();
        return () => {
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [tableId, onEvent]);
}
