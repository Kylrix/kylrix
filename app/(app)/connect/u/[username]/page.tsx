'use client';

import { useParams } from 'next/navigation';
import { Profile } from '@/components/profile/Profile';
import { Container } from '@mui/material';

export default function UserProfilePage() {
    const params = useParams();
    const username = params.username as string;

    return (
        <Container maxWidth="lg" sx={{ py: 3, pointerEvents: 'auto' }}>
            <Profile username={username} />
        </Container>
    );
}
