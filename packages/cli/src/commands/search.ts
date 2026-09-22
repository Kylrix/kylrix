import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function searchCommand(
  query: string,
  opts: { url?: string; token?: string; workspace?: string; json?: boolean; limit?: string }
) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const results = isAuthed
      ? await getClient(opts).search.query(query, {
          workspaceId: opts.workspace,
          limit,
        })
      : LocalStore.search(query);

    if (opts.json) {
      printJson(results);
      return;
    }

    if (!results || results.length === 0) {
      console.log(`\nNo items matching "${pc.bold(query)}" found.`);
      return;
    }

    console.log(`\nSearch results for "${pc.bold(query)}":\n`);
    const rows = results.map((r: any) => ({
      kind: r.kind.toUpperCase(),
      id: r.id,
      title: r.title,
      snippet: r.snippet || '',
      mode: isAuthed ? (r.isLocal ? pc.dim('local') : 'cloud') : pc.dim('local'),
    }));

    printTable(rows, ['kind', 'id', 'title', 'snippet', 'mode']);
  } catch (err: any) {
    printError('Search query failed', err);
    process.exit(1);
  }
}
