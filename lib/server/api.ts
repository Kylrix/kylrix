'use server';

export async function fetchTurnCredentials() {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;
  const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID || !TURN_KEY_ID) {
    return { success: false, error: 'Cloudflare configuration missing', iceServers: [] };
  }

  try {
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json'},
      body: JSON.stringify({ ttl: 86400 })});

    if (!response.ok) {
      return { success: false, error: await response.text(), iceServers: [] };
    }

    const resData = await response.json();
    return { success: true, ...resData };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error', iceServers: [] };
  }
}

