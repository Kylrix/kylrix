import { marked } from 'marked';

/**
 * Downloads a text file dynamically on the client.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports note or task content to Markdown.
 */
export function exportToMarkdown(title: string, content: string) {
  const md = `# ${title}\n\n${content}`;
  downloadFile(md, `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`, 'text/markdown;charset=utf-8;');
}

/**
 * Exports note or task content to PDF via browser print iframe channel.
 */
export function exportToPDF(title: string, markdownContent: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  let parsedHtml = '';
  try {
    parsedHtml = String(marked.parse(markdownContent));
  } catch (err) {
    parsedHtml = markdownContent.replace(/\n/g, '<br/>');
  }
  
  doc.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #000;
            padding: 40px;
            background: #fff;
          }
          h1 { font-size: 2.2rem; margin-bottom: 10px; border-bottom: 2px solid #eaeaea; padding-bottom: 8px; }
          h2 { font-size: 1.6rem; margin-top: 24px; margin-bottom: 12px; }
          p { margin-bottom: 16px; }
          code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
          pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; margin-bottom: 20px; }
          blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #555; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div>${parsedHtml}</div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.frameElement.remove();
            }, 1000);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
}

/**
 * Exports note or task content to Microsoft Word .doc.
 */
export function exportToDOCX(title: string, markdownContent: string) {
  let parsedHtml = '';
  try {
    parsedHtml = String(marked.parse(markdownContent));
  } catch {
    parsedHtml = markdownContent.replace(/\n/g, '<br/>');
  }

  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>" + title + "</title><style>body { font-family: Arial; }</style></head><body>";
  const footer = "</body></html>";
  const sourceHTML = header + parsedHtml + footer;
  
  const blob = new Blob([sourceHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports event to a Calendar object (.ics).
 */
export function exportToICS(title: string, description: string, startTime: string, endTime?: string) {
  const startStr = new Date(startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
  const endVal = endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 60 * 60 * 1000);
  const endStr = endVal.toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kylrix//Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "")}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description || ''}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  
  downloadFile(icsContent, `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`, 'text/calendar;charset=utf-8;');
}
