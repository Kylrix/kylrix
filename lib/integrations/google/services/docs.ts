export class GoogleDocsService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listDocuments() {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&pageSize=8&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Google Docs');
    return res.json();
  }

  async getDocument(docId: string) {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Doc');
    return res.json();
  }

  async createDocument(title: string) {
    const res = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Failed to create Google Doc');
    return res.json();
  }

  async updateDocument(docId: string, updates: any) {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update Google Doc');
    return res.json();
  }
}
