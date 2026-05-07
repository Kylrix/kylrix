export async function sendKylrixEmailNotification(payload: Record<string, unknown>) {
  const response = await fetch('/api/emails', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to queue notification email');
  }

  return response.json().catch(() => ({}));
}
