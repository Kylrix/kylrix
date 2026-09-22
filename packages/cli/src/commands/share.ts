import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { resolveEnvironment } from '../config';
import { printError, printJson, printSuccess } from '../formatter';

export async function shareCommand(
  kind: string,
  id: string,
  opts: { url?: string; token?: string; json?: boolean }
) {
  try {
    const client = requireAuthClient(opts);
    const env = resolveEnvironment(opts);
    const profile = await client.auth.me();

    const baseUrl = env.apiUrl.replace(/\/api\/v1$/, '');
    let shareUrl = `${baseUrl}/${kind}/${id}`;

    if (kind === 'vault' || kind === 'secret') {
      shareUrl = `${baseUrl}/vault/${id}`;
    }

    if (opts.json) {
      printJson({
        kind,
        id,
        shareUrl,
        isPro: profile.quotas?.isPro ?? false,
        maxCollaborators: profile.quotas?.maxCollaboratorsPerResource ?? 8,
      });
      return;
    }

    console.log('\n' + pc.bold('Resource Share Link:'));
    console.log(`  Kind: ${kind}`);
    console.log(`  ID:   ${id}`);
    console.log(`  URL:  ${pc.underline(pc.cyan(shareUrl))}`);
    console.log(`  Collaborator Cap: ${profile.quotas?.maxCollaboratorsPerResource || 8} users`);
    console.log();
  } catch (err: any) {
    printError(`Failed to generate share link for ${kind} "${id}"`, err);
    process.exit(1);
  }
}
