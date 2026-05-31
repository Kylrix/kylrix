export class GoogleMeetService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createSpace() {
    const res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to create Google Meet space');
    return res.json();
  }

  async getSpace(spaceName: string) {
    const res = await fetch(`https://meet.googleapis.com/v2/${spaceName}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Meet space details');
    return res.json();
  }
}
