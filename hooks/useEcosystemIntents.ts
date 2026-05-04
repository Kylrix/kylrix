'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { EcosystemBridge } from '@/lib/ecosystem/bridge';
import { useTask } from '@/context/TaskContext';

export const useEcosystemIntents = () => {
    const searchParams = useSearchParams();
    const { setTaskDialogOpen } = useTask();

    useEffect(() => {
        const intentData = EcosystemBridge.parseIntent(window.location.href);
        if (intentData?.intent === 'create_task') {
            setTaskDialogOpen(true);
        }
    }, [searchParams, setTaskDialogOpen]);
};
