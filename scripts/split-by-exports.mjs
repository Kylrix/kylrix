import fs from 'fs';
import path from 'path';

const MAX = 990;

function splitByExportRegex(filePath, re) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  if (lines.length <= MAX) return;
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) starts.push(i);
  }
  if (starts.length < 2) {
    console.log('few exports', filePath);
    return;
  }
  const header = lines.slice(0, starts[0]);
  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const e = i + 1 < starts.length ? starts[i + 1] : lines.length;
    blocks.push(lines.slice(starts[i], e));
  }
  const stem = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const dir = path.dirname(filePath);
  // shared header
  const sharedPath = path.join(dir, `${stem}-shared${ext}`);
  let shared = header.join('\n') + '\n';
  // export helpers in header
  fs.writeFileSync(sharedPath, shared);
  const chunks = [];
  let cur = [], cl = 0;
  const budget = MAX - header.length - 5;
  for (const b of blocks) {
    if (cur.length && cl + b.length > budget) {
      chunks.push(cur);
      cur = [];
      cl = 0;
    }
    cur.push(...b);
    cl += b.length;
  }
  if (cur.length) chunks.push(cur);

  const partFiles = [];
  for (let i = 0; i < chunks.length; i++) {
    const pf = path.join(dir, `${stem}-part${i + 1}${ext}`);
    const body = `export * from './${stem}-shared';\n` + (ext.endsWith('ts') && !header.some(l => l.startsWith('import')) ? '' : '') + chunks[i].join('\n') + '\n';
    // Better: each part includes header imports + its exports
    const body2 = header.join('\n') + '\n' + chunks[i].join('\n') + '\n';
    fs.writeFileSync(pf, body2);
    partFiles.push(`./${stem}-part${i + 1}`);
    console.log(pf, body2.split('\n').length);
  }
  fs.writeFileSync(filePath, partFiles.map((p) => `export * from '${p}';`).join('\n') + '\n');
  // remove shared if unused
  fs.unlinkSync(sharedPath);
  console.log('barrel', filePath, partFiles.length);
}

for (const f of process.argv.slice(2)) {
  const text = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.d.ts')) {
    splitByExportRegex(f, /^(export )?(declare )?(type|interface|class|namespace|const|enum) /);
  } else {
    splitByExportRegex(f, /^export /);
  }
}
