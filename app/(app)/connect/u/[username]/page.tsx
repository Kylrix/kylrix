'use client';

import { useParams } from 'next/navigation';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Profile } from '@/components/profile/Profile';
import { Container } from '@mui/material';

export default function UserProfilePage() {
    const params = useParams();
    const username = params.username as string;

    return (
        <ConnectAppShell>
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Profile username={username} />
            </Container>
        </ConnectAppShell>
    );
}
