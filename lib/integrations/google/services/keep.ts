export class GoogleKeepService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listNotes() {
    const res = await fetch('https://keep.googleapis.com/v1/notes', {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Keep notes');
    return res.json();
  }

  async createNote(title: string, body: string) {
    const res = await fetch('https://keep.googleapis.com/v1/notes', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) throw new Error('Failed to create Keep note');
    return res.json();
  }

  async deleteNote(noteName: string) {
    const res = await fetch(`https://keep.googleapis.com/v1/${noteName}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to delete Keep note');
    return true;
  }
}
