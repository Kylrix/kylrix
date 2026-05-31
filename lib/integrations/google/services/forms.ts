export class GoogleFormsService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listForms(query?: string, pageSize: number = 15) {
    const defaultQuery = "mimeType='application/vnd.google-apps.form' and trashed=false";
    const finalQuery = query ? encodeURIComponent(query) : encodeURIComponent(defaultQuery);
    
    // Uses Drive API to find forms
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${finalQuery}&pageSize=${pageSize}&orderBy=modifiedTime desc&fields=files(id,name,webViewLink)`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Google Forms');
    return res.json();
  }

  async getForm(formId: string) {
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Form details');
    return res.json();
  }

  async getFormResponses(formId: string) {
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Form responses');
    return res.json();
  }
}
