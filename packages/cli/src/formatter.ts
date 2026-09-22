import pc from 'picocolors';

export function printJson(data: any) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export function printSuccess(message: string) {
  console.log(pc.green('✔') + ' ' + message);
}

export function printError(message: string, error?: any) {
  console.error(pc.red('✖') + ' ' + pc.bold(message));
  if (error && error.message && error.message !== message) {
    console.error(pc.dim(`  ${error.message}`));
  }
}

export function printWarning(message: string) {
  console.log(pc.yellow('⚠') + ' ' + message);
}

export function printInfo(message: string) {
  console.log(pc.cyan('ℹ') + ' ' + message);
}

export function printTable(rows: Record<string, any>[], columns?: string[]) {
  if (!rows || rows.length === 0) {
    console.log(pc.dim('No items found.'));
    return;
  }

  const cols = columns || Object.keys(rows[0]);
  
  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of cols) {
    let max = col.length;
    for (const r of rows) {
      const val = String(r[col] ?? '');
      if (val.length > max) {
        max = Math.min(val.length, 60); // Cap width at 60
      }
    }
    widths[col] = max;
  }

  // Header
  const header = cols.map((col) => pc.bold(col.toUpperCase().padEnd(widths[col]))).join('  ');
  console.log(header);
  console.log(cols.map((col) => pc.dim('─'.repeat(widths[col]))).join('  '));

  // Rows
  for (const r of rows) {
    const line = cols
      .map((col) => {
        let val = String(r[col] ?? '');
        if (val.length > 60) {
          val = val.substring(0, 57) + '...';
        }
        return val.padEnd(widths[col]);
      })
      .join('  ');
    console.log(line);
  }
  console.log(pc.dim(`\nTotal: ${rows.length}`));
}
