export class GoogleSheetsService {
  constructor(private readonly accessToken: string) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listSpreadsheets() {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&pageSize=10&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink)`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to list Google Sheets');
    return res.json();
  }

  async getSpreadsheet(spreadsheetId: string) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets(properties(sheetId,title,index))`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Sheet details');
    return res.json();
  }

  async getValues(spreadsheetId: string, range: string) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch Google Sheet values');
    return res.json();
  }

  async createSpreadsheet(title: string) {
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ properties: { title } }),
    });
    if (!res.ok) throw new Error('Failed to create Google Sheet');
    return res.json();
  }

  async appendRow(spreadsheetId: string, range: string, values: any[][]) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error('Failed to append row to Google Sheet');
    return res.json();
  }

  async updateCell(spreadsheetId: string, range: string, values: any[][]) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error('Failed to update cell in Google Sheet');
    return res.json();
  }
}
