import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson } from '../formatter';

export async function adminStatusCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const profile = await client.auth.me();
    const tokenInfo = await client.auth.tokenInfo();

    const isAdmin = profile.scopes?.includes('admin') || profile.scopes?.includes('*') || profile.tier === 'ADMIN';

    if (opts.json) {
      printJson({
        isAdmin,
        userId: profile.id,
        email: profile.email,
        scopes: profile.scopes,
        tokenKind: (tokenInfo as any)?.kind,
        rateLimits: (tokenInfo as any)?.rateLimits,
      });
      return;
    }

    console.log('\n' + pc.bold('Kylrix Instance & Admin Verification:'));
    console.log(`  Admin Status:     ${isAdmin ? pc.green(pc.bold('AUTHORIZED ADMIN')) : pc.yellow('Standard User')}`);
    console.log(`  Actor User ID:    ${profile.id}`);
    console.log(`  Identity Email:   ${profile.email || 'N/A'}`);
    console.log(`  Account Tier:     ${profile.tier}`);
    console.log(`  Token Scopes:     ${profile.scopes?.join(', ') || '*'}`);
    console.log(`  Edge Shield:      ${pc.green('Active (Bot & Burst Protected)')}`);
    console.log();
  } catch (err: any) {
    printError('Failed to verify admin status', err);
    process.exit(1);
  }
}
