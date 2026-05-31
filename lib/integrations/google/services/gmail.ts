export class GoogleGmailService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listLabels() {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Gmail labels');
    return res.json();
  }

  async listMessages(labelId?: string, query?: string) {
    const labelParam = labelId ? `&labelIds=${labelId}` : '';
    const queryParam = query ? `&q=${encodeURIComponent(query)}` : '';
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10${labelParam}${queryParam}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Gmail messages');
    return res.json();
  }

  async getMessage(messageId: string) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Gmail message');
    return res.json();
  }

  async sendMessage(rawRfc2822: string) {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ raw: rawRfc2822 }),
    });
    if (!res.ok) throw new Error('Failed to send Gmail message');
    return res.json();
  }

  async trashMessage(messageId: string) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to trash Gmail message');
    return res.json();
  }
}
