import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { getClient } from '../client';
import { loadConfig, saveConfig, clearConfig, resolveEnvironment } from '../config';
import { printError, printInfo, printJson, printSuccess } from '../formatter';

export async function loginCommand(opts: { url?: string; token?: string }) {
  clack.intro(pc.bgCyan(pc.black(' Kylrix Authentication ')));

  const currentConfig = loadConfig();
  const defaultUrl = opts.url || currentConfig.apiUrl || 'https://www.kylrix.space';

  const method = await clack.select({
    message: 'How would you like to authenticate?',
    options: [
      { value: 'pair', label: 'Device Pairing (Recommended - Open in Browser / Scan Code)' },
      { value: 'pat', label: 'Personal Access Token (PAT)' },
      { value: 'credentials', label: 'Email & Password' },
    ],
  });

  if (clack.isCancel(method)) {
    clack.cancel('Authentication cancelled.');
    process.exit(0);
  }

  const urlAnswer = await clack.text({
    message: 'Kylrix Instance URL:',
    initialValue: defaultUrl,
    validate: (val) => {
      if (!val) return 'URL is required';
      try {
        new URL(val);
      } catch {
        return 'Invalid URL format';
      }
    },
  });

  if (clack.isCancel(urlAnswer)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  const apiUrl = String(urlAnswer).replace(/\/+$/, '');

  if (method === 'pair') {
    await pairCommand({ url: apiUrl });
    return;
  }

  if (method === 'pat') {
    const patAnswer = await clack.text({
      message: 'Enter your Personal Access Token (PAT):',
      placeholder: 'pat_...',
      validate: (val) => (!val ? 'Token cannot be empty' : undefined),
    });

    if (clack.isCancel(patAnswer)) {
      clack.cancel('Cancelled.');
      process.exit(0);
    }

    const token = String(patAnswer).trim();
    const spinner = clack.spinner();
    spinner.start('Verifying token with Kylrix...');

    try {
      const client = getClient({ url: apiUrl, token });
      const profile = await client.auth.me();
      spinner.stop(pc.green('Authenticated successfully!'));

      saveConfig({
        apiUrl,
        token,
        userId: profile.id,
        email: profile.email,
      });

      clack.note(
        `User ID: ${profile.id}\nEmail: ${profile.email || 'N/A'}\nScopes: ${profile.scopes?.join(', ') || 'all'}`,
        'Active Session'
      );
      clack.outro(pc.green('CLI configured and ready!'));
    } catch (err: any) {
      spinner.stop(pc.red('Authentication failed.'));
      printError(err.message || 'Invalid PAT or unreachable server.');
      process.exit(1);
    }
  }

  if (method === 'credentials') {
    const emailAnswer = await clack.text({
      message: 'Email:',
      validate: (val) => (!val ? 'Email cannot be empty' : undefined),
    });
    if (clack.isCancel(emailAnswer)) {
      clack.cancel('Cancelled.');
      process.exit(0);
    }

    const passwordAnswer = await clack.password({
      message: 'Password:',
      validate: (val) => (!val ? 'Password cannot be empty' : undefined),
    });
    if (clack.isCancel(passwordAnswer)) {
      clack.cancel('Cancelled.');
      process.exit(0);
    }

    const spinner = clack.spinner();
    spinner.start('Signing in to Kylrix...');

    try {
      const client = getClient({ url: apiUrl });
      const res = await client.auth.signin({
        email: String(emailAnswer).trim(),
        password: String(passwordAnswer),
      });

      spinner.stop(pc.green('Signed in successfully!'));

      saveConfig({
        apiUrl,
        token: res.token,
        userId: res.user?.id || res.user?.$id,
        email: String(emailAnswer).trim(),
      });

      clack.outro(pc.green('CLI configured and ready!'));
    } catch (err: any) {
      spinner.stop(pc.red('Sign-in failed.'));
      printError(err.message || 'Invalid credentials or login endpoint unavailable.');
      process.exit(1);
    }
  }
}

export async function pairCommand(opts: { url?: string; json?: boolean }) {
  const env = resolveEnvironment({ url: opts.url });
  const client = getClient({ url: env.apiUrl });

  try {
    const session = await client.pairing.requestPairing({
      clientName: 'Kylrix CLI',
      clientType: 'cli',
      requestedScopes: ['*'],
    });

    if (opts.json) {
      printJson(session);
      return;
    }

    console.log('\n' + pc.bold(pc.cyan('Pairing Authorization Required:')));
    console.log(
      `1. Open: ${pc.underline(pc.bold(session.verificationUri || `${env.apiUrl.replace(/\/api\/v1$/, '')}/connect/pair`))}`
    );
    console.log(`2. Enter Code: ${pc.bgYellow(pc.black(` ${session.userCode} `))}\n`);

    const spinner = clack.spinner();
    spinner.start('Waiting for browser approval...');

    const result = await client.pairing.pollExchange(session.deviceCode, {
      intervalSeconds: session.interval || 3,
      timeoutSeconds: session.expiresIn || 600,
    });

    spinner.stop(pc.green('Pairing approved!'));

    saveConfig({
      apiUrl: env.apiUrl,
      token: result.token,
      userId: result.userId,
    });

    printSuccess(`Logged in as user: ${pc.bold(result.userId)}`);
  } catch (err: any) {
    printError('Device pairing failed', err);
    process.exit(1);
  }
}

export async function whoamiCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = getClient(opts);
    const env = resolveEnvironment(opts);

    if (!env.token) {
      if (opts.json) {
        printJson({ authenticated: false, message: 'Not authenticated' });
      } else {
        printInfo('Not currently logged in. Run `kylrix login` to authenticate.');
      }
      return;
    }

    const profile = await client.auth.me();

    if (opts.json) {
      printJson(profile);
      return;
    }

    console.log('\n' + pc.bold('Kylrix Session Info:'));
    console.log(`  ${pc.dim('User ID:')}      ${pc.bold(profile.id)}`);
    console.log(`  ${pc.dim('Email:')}        ${profile.email || 'N/A'}`);
    console.log(`  ${pc.dim('API URL:')}      ${env.apiUrl}`);
    console.log(`  ${pc.dim('Scopes:')}       ${profile.scopes?.join(', ') || 'all'}`);
    if (profile.workspaceId) {
      console.log(`  ${pc.dim('Workspace:')}    ${profile.workspaceId}`);
    }
    console.log();
  } catch (err: any) {
    printError('Failed to fetch profile', err);
    process.exit(1);
  }
}

export function logoutCommand() {
  clearConfig();
  printSuccess('Logged out successfully. Removed saved credentials.');
}
