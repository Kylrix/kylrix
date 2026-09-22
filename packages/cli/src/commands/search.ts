import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printTable } from '../formatter';

export async function searchCommand(
  query: string,
  opts: { url?: string; token?: string; workspace?: string; json?: boolean; limit?: string }
) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const results = await client.search.query(query, {
      workspaceId: opts.workspace,
      limit,
    });

    if (opts.json) {
      printJson(results);
      return;
    }

    if (!results || results.length === 0) {
      console.log(`\nNo items matching "${pc.bold(query)}" found.`);
      return;
    }

    console.log(`\nSearch results for "${pc.bold(query)}":\n`);
    const rows = results.map((r) => ({
      kind: r.kind.toUpperCase(),
      id: r.id,
      title: r.title,
      snippet: r.snippet || '',
    }));

    printTable(rows, ['kind', 'id', 'title', 'snippet']);
  } catch (err: any) {
    printError('Search query failed', err);
    process.exit(1);
  }
}
