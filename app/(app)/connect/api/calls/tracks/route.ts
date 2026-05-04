import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { sessionId, tracks } = await req.json();
    const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
    const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

    if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
        return NextResponse.json({ error: 'Cloudflare configuration missing' }, { status: 500 });
    }

    try {
        const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${sessionId}/tracks/new`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tracks })
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json({ error: 'Cloudflare Track Init Failed', details: error }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error('Tracks API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
