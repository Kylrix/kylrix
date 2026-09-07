#!/usr/bin/env node
/**
 * Extract large nested functions from oversized TS/TSX files until each file is ≤ maxLines.
 */
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const MAX = Number(process.env.SPLIT_MAX || 990);
const MIN_EXTRACT = Number(process.env.SPLIT_MIN || 60);

function lineOf(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line;
}

function processFile(filePath, depth = 0) {
  if (depth > 8) return;
  if (!fs.existsSync(filePath)) return;
  let sourceText = fs.readFileSync(filePath, 'utf8');
  let lines = sourceText.split('\n');
  if (lines.length <= MAX) {
    console.log('OK', filePath, lines.length);
    return;
  }
  console.log('PROCESS', filePath, lines.length, 'depth', depth);

  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const candidates = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer) ||
        (ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          ['useCallback', 'useMemo'].includes(node.initializer.expression.text)))
    ) {
      const start = lineOf(sf, node.getStart(sf));
      const end = lineOf(sf, node.getEnd());
      const nlines = end - start + 1;
      // Never extract the file's primary exported component shell
      const vs = node.parent && node.parent.parent;
      const isExportedConst =
        vs &&
        ts.isVariableStatement(vs) &&
        (vs.modifiers || []).some(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword,
        );
      const stem = path.basename(filePath, path.extname(filePath));
      const isPrimaryShell =
        isExportedConst &&
        (node.name.text === stem || nlines > lines.length * 0.45);
      if (nlines >= MIN_EXTRACT && !isPrimaryShell) {
        candidates.push({
          name: node.name.text,
          nlines,
          node,
          startPos: node.getStart(sf),
          endPos: node.getEnd(),
          isFnDecl: false,
        });
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      // Never extract the file's exported/default component shell
      const mods = node.modifiers || [];
      const isExported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword);
      if (isExported) {
        // still visit children
      } else {
        const start = lineOf(sf, node.getStart(sf));
        const end = lineOf(sf, node.getEnd());
        const nlines = end - start + 1;
        const stem = path.basename(filePath, path.extname(filePath));
        if (nlines >= MIN_EXTRACT && nlines < lines.length - 5 && node.name.text !== stem) {
          candidates.push({
            name: node.name.text,
            nlines,
            node,
            startPos: node.getStart(sf),
            endPos: node.getEnd(),
            isFnDecl: true,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  candidates.sort((a, b) => b.nlines - a.nlines);

  const chosen = [];
  let budget = lines.length;
  for (const c of candidates) {
    if (budget <= MAX) break;
    if (chosen.some((x) => c.startPos >= x.startPos && c.endPos <= x.endPos)) continue;
    // skip thin wrappers already extracted
    if (c.nlines <= 3) continue;
    chosen.push(c);
    budget -= c.nlines - 2;
  }

  if (!chosen.length) {
    console.log('  NO CANDIDATES', filePath);
    return;
  }

  const stem = path.basename(filePath, path.extname(filePath));
  const dir = path.join(path.dirname(filePath), stem + 'Sections');
  fs.mkdirSync(dir, { recursive: true });

  let hdr = '';
  for (const l of lines) {
    if (
      l.startsWith('import ') ||
      l.startsWith("'use client'") ||
      l.startsWith('"use client"') ||
      l.startsWith('import type')
    ) {
      hdr += l + '\n';
    } else if (l.trim() === '' && hdr) {
      hdr += '\n';
    } else if (hdr) break;
  }

  const bagNames = new Set();
  for (const l of lines) {
    let m;
    if ((m = /^  const \[(\w+), (\w+)\]/.exec(l))) {
      bagNames.add(m[1]);
      bagNames.add(m[2]);
    }
    if ((m = /^  const (\w+) =/.exec(l))) bagNames.add(m[1]);
    if ((m = /^  function (\w+)/.exec(l))) bagNames.add(m[1]);
  }
  for (const c of chosen) bagNames.add(c.name);
  const unpack = [...bagNames].sort().join(',\n  ');
  const bagSpread = `{ ${[...bagNames].sort().join(', ')} }`;

  const importsToAdd = [];
  const reps = [];

  for (const c of chosen) {
    let init = c.isFnDecl ? c.node : c.node.initializer;
    let hookKind = null;
    let hookDeps = '[]';
    if (
      !c.isFnDecl &&
      ts.isCallExpression(init) &&
      ts.isIdentifier(init.expression) &&
      ['useCallback', 'useMemo'].includes(init.expression.text)
    ) {
      hookKind = init.expression.text;
      if (init.arguments[1]) {
        hookDeps = sourceText.slice(init.arguments[1].getStart(sf), init.arguments[1].getEnd());
      }
      init = init.arguments[0];
    }
    const bodyNode = c.isFnDecl
      ? c.node.body
      : init.body && ts.isBlock(init.body)
        ? init.body
        : null;
    let innerBody;
    if (bodyNode && ts.isBlock(bodyNode)) {
      innerBody = sourceText.slice(bodyNode.statements.pos, bodyNode.statements.end);
    } else if (!c.isFnDecl && ts.isArrowFunction(init) && init.body && !ts.isBlock(init.body)) {
      innerBody = `return (${sourceText.slice(init.body.getStart(sf), init.body.getEnd())});`;
    } else {
      console.log('  skip weird', c.name);
      continue;
    }

    let outPath = path.join(dir, `${c.name}.tsx`);
    let n = 1;
    while (fs.existsSync(outPath) && fs.readFileSync(outPath, 'utf8').includes('extracted body')) {
      outPath = path.join(dir, `${c.name}_${n}.tsx`);
      n++;
    }
    // Always write unique per extraction wave
    if (fs.existsSync(outPath)) {
      outPath = path.join(dir, `${c.name}_d${depth}_${Date.now() % 100000}.tsx`);
    }

    const fileTxt = `${hdr}
export function ${c.name}(bag: any) {
  const {
  ${unpack}
  } = bag as any;
${innerBody}
}
`;
    fs.writeFileSync(outPath, fileTxt);
    const rel = './' + path.relative(path.dirname(filePath), outPath).replace(/\\/g, '/').replace(/\.tsx$/, '');
    importsToAdd.push(`import { ${c.name} as ${c.name}_ext } from '${rel}';`);
    console.log('  extract', c.name, c.nlines, '->', fileTxt.split('\n').length, path.basename(outPath));

    let startReplace = c.startPos;
    if (!c.isFnDecl) {
      const before = sourceText.lastIndexOf('const ', c.startPos);
      if (before >= 0 && c.startPos - before < 30) startReplace = before;
    } else {
      const fnBefore = sourceText.lastIndexOf('function ', c.startPos);
      if (fnBefore >= 0 && c.startPos - fnBefore < 40) startReplace = fnBefore;
      if (sourceText.slice(Math.max(0, startReplace - 10), startReplace).includes('async')) {
        startReplace = sourceText.lastIndexOf('async', startReplace);
      }
      while (startReplace > 0 && sourceText[startReplace - 1] === ' ') startReplace--;
    }
    let endReplace = c.endPos;
    if (sourceText[endReplace] === ';') endReplace++;

    let replacement;
    if (hookKind === 'useCallback') {
      replacement = `const ${c.name} = ${hookKind}((..._args: any[]) => ${c.name}_ext(${bagSpread}, ..._args), ${hookDeps});`;
    } else if (hookKind === 'useMemo') {
      replacement = `const ${c.name} = ${hookKind}(() => ${c.name}_ext(${bagSpread}), ${hookDeps});`;
    } else {
      replacement = `const ${c.name} = (..._args: any[]) => ${c.name}_ext(${bagSpread});`;
    }
    reps.push({ startReplace, endReplace, replacement });
  }

  reps.sort((a, b) => b.startReplace - a.startReplace);
  let newText = sourceText;
  for (const r of reps) {
    newText = newText.slice(0, r.startReplace) + r.replacement + newText.slice(r.endReplace);
  }

  let lastImportEnd = 0;
  const re = /^import .+$/gm;
  let m;
  while ((m = re.exec(newText))) lastImportEnd = m.index + m[0].length;
  const importBlock = '\n' + importsToAdd.join('\n') + '\n';
  if (lastImportEnd > 0) {
    newText = newText.slice(0, lastImportEnd) + importBlock + newText.slice(lastImportEnd);
  } else {
    newText = importBlock + newText;
  }

  fs.writeFileSync(filePath, newText);
  console.log('  main', newText.split('\n').length);

  processFile(filePath, depth + 1);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) {
        processFile(path.join(dir, f), depth + 1);
      }
    }
  }
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: node scripts/split-oversized.mjs <file>...');
  process.exit(1);
}
for (const t of targets) processFile(path.resolve(t));
