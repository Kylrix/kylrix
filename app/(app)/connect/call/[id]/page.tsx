'use client';

import { PublicCall } from './PublicCall';
import { useParams } from 'next/navigation';

export default function CallPage() {
    const params = useParams();
    const id = params.id as string;
    
    // We now treat all /call/[id] routes as potential call links using the row ID
    // If it's not a public link, it will be handled by the PublicCall component's lookup
    // Standard conversation-based calls (not via link) might still exist but the user wants to fix the call/id page
    // for links specifically.
    
    // If it's a standard conversation ID (usually UUID-like or specific format), we might still use CallInterface
    // But the user said: "instead of using a six or whatever digit in the call/{id} we use the id of the table"
    // This implies /call/[id] is primarily for these links now.
    
    return <PublicCall id={id} />;
}
