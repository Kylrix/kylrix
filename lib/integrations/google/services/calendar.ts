export class GoogleCalendarService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listUpcomingEvents(timeMin: string = new Date().toISOString()) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${timeMin}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch calendar events');
    return res.json();
  }
}
