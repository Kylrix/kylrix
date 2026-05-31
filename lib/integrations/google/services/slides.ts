export class GoogleSlidesService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listPresentations(query?: string, pageSize: number = 15) {
    const defaultQuery = "mimeType='application/vnd.google-apps.presentation' and trashed=false";
    const finalQuery = query ? encodeURIComponent(query) : encodeURIComponent(defaultQuery);
    
    // Uses Drive API to find presentations
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${finalQuery}&pageSize=${pageSize}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink)`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Google Slides');
    return res.json();
  }

  async getPresentation(presentationId: string) {
    const res = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Slides details');
    return res.json();
  }

  async createPresentation(title: string) {
    const res = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Failed to create Google Slides presentation');
    return res.json();
  }
}
