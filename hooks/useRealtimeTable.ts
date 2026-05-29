import { useEffect, useRef } from 'react';
import { Models } from 'appwrite';
import { subscribeToTable } from '../lib/kylrixflow';

export function useRealtimeTable<T extends Models.Row>(
    tableId: string,
    onEvent: (event: { type: 'create' | 'update' | 'delete', payload: T }) => void,
    options?: { throttleMs?: number }
) {
    const onEventRef = useRef(onEvent);
    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    const throttleMs = options?.throttleMs;
    const lastEventTimeRef = useRef<number>(0);
    const pendingEventsRef = useRef<{ type: 'create' | 'update' | 'delete'; payload: T }[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let unsub: any;
        const init = async () => {
            unsub = await subscribeToTable<T>(tableId, (event) => {
                if (throttleMs) {
                    const now = Date.now();
                    const elapsed = now - lastEventTimeRef.current;
                    pendingEventsRef.current.push(event);

                    const runThrottled = () => {
                        if (pendingEventsRef.current.length === 0) return;
                        // Process the latest event
                        const latest = pendingEventsRef.current[pendingEventsRef.current.length - 1];
                        pendingEventsRef.current = [];
                        lastEventTimeRef.current = Date.now();
                        onEventRef.current(latest);
                    };

                    if (elapsed >= throttleMs) {
                        runThrottled();
                    } else {
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = setTimeout(runThrottled, throttleMs - elapsed);
                    }
                } else {
                    onEventRef.current(event);
                }
            });
        };
        init();
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (typeof unsub === 'function') unsub();
            else if (unsub?.unsubscribe) unsub.unsubscribe();
        };
    }, [tableId, throttleMs]);
}
