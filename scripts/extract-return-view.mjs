import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const MAX = 990;

function extract(filePath) {
  let sourceText = fs.readFileSync(filePath, 'utf8');
  let lines = sourceText.split('\n');
  if (lines.length <= MAX) {
    console.log('OK', filePath, lines.length);
    return;
  }

  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  // Find largest function-like (component) 
  let target = null;
  function consider(node, name) {
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
    const nlines = end - start + 1;
    if (!target || nlines > target.nlines) {
      target = { node, name, nlines, start, end };
    }
  }
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) {
      consider(node, node.name?.text || 'anon');
    }
    if (ts.isVariableDeclaration(node) && node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      consider(node.initializer, ts.isIdentifier(node.name) ? node.name.text : 'anon');
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!target) {
    console.log('no target', filePath);
    return;
  }

  const fn = target.node;
  const body = fn.body;
  if (!body || !ts.isBlock(body)) {
    console.log('no block body', filePath);
    return;
  }

  // Find last return statement that returns JSX (
  let retStmt = null;
  for (const stmt of body.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      retStmt = stmt;
    }
  }
  if (!retStmt || !retStmt.expression) {
    console.log('no return expr', filePath);
    return;
  }

  const retStart = retStmt.getStart(sf);
  const retEnd = retStmt.getEnd();
  const retLine = sf.getLineAndCharacterOfPosition(retStart).line;
  const bodyEndLine = sf.getLineAndCharacterOfPosition(body.getEnd()).line;
  const jsxLines = bodyEndLine - retLine;
  console.log(filePath, 'component', target.name, 'jsx~', jsxLines, 'total', lines.length);
  if (jsxLines < 50) {
    console.log('  jsx too small to help');
    return;
  }

  // Collect bag names from component body before return
  const bagNames = new Set();
  for (let i = target.start; i < retLine; i++) {
    const l = lines[i];
    let m;
    if ((m = /^\s*const \[(\w+), (\w+)\]/.exec(l))) {
      bagNames.add(m[1]); bagNames.add(m[2]);
    }
    if ((m = /^\s*const (\w+) =/.exec(l))) bagNames.add(m[1]);
    if ((m = /^\s*(?:async )?function (\w+)/.exec(l))) bagNames.add(m[1]);
    if ((m = /^\s*let (\w+)/.exec(l))) bagNames.add(m[1]);
  }
  // also props from parameters
  if (fn.parameters) {
    for (const p of fn.parameters) {
      if (ts.isIdentifier(p.name)) bagNames.add(p.name.text);
      if (ts.isObjectBindingPattern(p.name)) {
        for (const el of p.name.elements) {
          if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) bagNames.add(el.name.text);
        }
      }
    }
  }

  const unpack = [...bagNames].sort().join(',\n    ');
  const stem = path.basename(filePath, path.extname(filePath));
  const dir = path.join(path.dirname(filePath), stem + 'Sections');
  fs.mkdirSync(dir, { recursive: true });

  // header imports
  let hdr = '';
  for (const l of lines) {
    if (l.startsWith('import ') || l.startsWith("'use client'") || l.startsWith('"use client"') || l.startsWith('import type')) {
      hdr += l + '\n';
    } else if (l.trim() === '' && hdr) hdr += '\n';
    else if (hdr) break;
  }

  const retText = sourceText.slice(retStart, retEnd);
  // retText is `return (...);` — view should be the expression
  let expr = retText.replace(/^return\s*/, '').replace(/;?\s*$/, '');
  
  const viewName = `${stem}View`;
  let viewPath = path.join(dir, `${viewName}.tsx`);
  let viewTxt = `${hdr}
export function ${viewName}(bag: any) {
  const {
    ${unpack}
  } = bag as any;
  return ${expr};
}
`;
  // If view still over, we'll bisect later
  fs.writeFileSync(viewPath, viewTxt);
  console.log('  wrote view', viewTxt.split('\n').length);

  const rel = './' + path.relative(path.dirname(filePath), viewPath).replace(/\\/g, '/').replace(/\.tsx$/, '');
  const bagSpread = `{ ${[...bagNames].sort().join(', ')} }`;
  const replacement = `return <${viewName} {...(${bagSpread})} />;`;
  
  let newText = sourceText.slice(0, retStart) + replacement + sourceText.slice(retEnd);
  // add import
  let lastImportEnd = 0;
  const re = /^import .+$/gm;
  let m;
  while ((m = re.exec(newText))) lastImportEnd = m.index + m[0].length;
  const importLine = `\nimport { ${viewName} } from '${rel}';\n`;
  if (lastImportEnd > 0) newText = newText.slice(0, lastImportEnd) + importLine + newText.slice(lastImportEnd);
  else newText = importLine + newText;

  fs.writeFileSync(filePath, newText);
  console.log('  main now', newText.split('\n').length);

  // Bisect view if needed
  if (viewTxt.split('\n').length > MAX) {
    bisectView(viewPath, hdr, viewName);
  }
}

function bisectView(viewPath, hdr, viewName) {
  let text = fs.readFileSync(viewPath, 'utf8');
  let lines = text.split('\n');
  if (lines.length <= MAX) return;
  const mid = Math.floor(lines.length / 2);
  let cut = mid;
  for (let j = mid; j < Math.min(mid + 80, lines.length - 2); j++) {
    const s = lines[j].trim();
    if (s.startsWith('</') || s === '}' || s === ')}' || s === '/>' || s === '') {
      cut = j + 1;
      break;
    }
  }
  // Find return ( line
  const retIdx = lines.findIndex((l) => l.includes('return'));
  const unpackEnd = lines.findIndex((l, i) => i > 0 && l.trim() === '} = bag as any;');
  const head = lines.slice(0, retIdx + 1).join('\n'); // through return
  // This bisect is fragile for JSX; use fragment split of lines between return and end
  const openIdx = retIdx;
  const closeIdx = lines.length - 2;
  const inner = lines.slice(openIdx + 1, closeIdx);
  const cutInner = Math.floor(inner.length / 2);
  let ci = cutInner;
  for (let j = cutInner; j < Math.min(cutInner + 60, inner.length - 1); j++) {
    if (inner[j].trim().startsWith('</') || inner[j].trim() === '' || inner[j].trim().endsWith(')}')) {
      ci = j + 1;
      break;
    }
  }
  const dir = path.dirname(viewPath);
  const p1 = path.join(dir, `${viewName}Part1.tsx`);
  const p2 = path.join(dir, `${viewName}Part2.tsx`);
  const unpackBlock = lines.slice(0, openIdx).join('\n'); // includes function + unpack
  
  const mk = (name, chunk) => `${hdr}
export function ${name}(bag: any) {
${lines.slice(1, openIdx).join('\n').replace(viewName, name)}
  return (
    <>
${chunk.join('\n')}
    </>
  );
}
`;
  // simpler:
  const unpackOnly = [];
  let inUnpack = false;
  for (const l of lines) {
    if (l.includes('= bag as any')) {
      unpackOnly.push(l);
      break;
    }
    if (l.includes('export function') || l.includes('const {') || inUnpack || l.trim() === 'const {') {
      unpackOnly.push(l.replace(`function ${viewName}`, `function PLACEHOLDER`));
      if (l.includes('const {')) inUnpack = true;
    }
  }

  fs.writeFileSync(p1, `${hdr}
export function ${viewName}Part1(bag: any) {
  const bagAny = bag as any;
  const {
${[...text.matchAll(/^\s+(\w+),?$/gm)].slice(0,5).map(()=>'').join('')}
  } = bagAny;
  // full unpack:
  ${lines.find(l => l.includes('= bag as any')) ? '' : ''}
${text.split('= bag as any;')[0].split('export function')[1]?.split('\n').slice(1).join('\n') || ''}
  return (
    <>
${inner.slice(0, ci).join('\n')}
    </>
  );
}
`.replace(/export function[^\n]+/, `export function ${viewName}Part1(bag: any)`));

  // Even simpler approach: duplicate full unpack from original view
  const unpackSection = text.slice(text.indexOf('const {'), text.indexOf('= bag as any;') + '= bag as any;'.length);
  
  fs.writeFileSync(p1, `${hdr}
export function ${viewName}Part1(bag: any) {
  ${unpackSection}
  return (
    <>
${inner.slice(0, ci).join('\n')}
    </>
  );
}
`);
  fs.writeFileSync(p2, `${hdr}
export function ${viewName}Part2(bag: any) {
  ${unpackSection}
  return (
    <>
${inner.slice(ci).join('\n')}
    </>
  );
}
`);
  fs.writeFileSync(viewPath, `${hdr}
import { ${viewName}Part1 } from './${viewName}Part1';
import { ${viewName}Part2 } from './${viewName}Part2';

export function ${viewName}(bag: any) {
  return (
    <>
      <${viewName}Part1 {...bag} />
      <${viewName}Part2 {...bag} />
    </>
  );
}
`);
  console.log('  bisected view', fs.readFileSync(p1,'utf8').split('\n').length, fs.readFileSync(p2,'utf8').split('\n').length);
  for (const p of [p1, p2]) {
    if (fs.readFileSync(p,'utf8').split('\n').length > MAX) {
      // recurse once more by calling extract on part - skip for now
      console.log('  part still over', p);
    }
  }
}

for (const f of process.argv.slice(2)) extract(path.resolve(f));
