import { spawn } from 'node:child_process';
import pc from 'picocolors';
import { resolveEnvSource } from './envs';
import { printError } from '../formatter';

export async function execCommand(
  idOrUrl: string,
  commandArgs: string[],
  opts: {
    url?: string;
    token?: string;
    shareKey?: string;
  }
) {
  try {
    if (!commandArgs || commandArgs.length === 0) {
      printError('Missing command to execute. Usage: `kylrix exec <id-or-url> -- <command...>`');
      process.exit(1);
    }

    const resolved = await resolveEnvSource(idOrUrl, opts);
    const varCount = Object.keys(resolved.variables).length;

    console.log(pc.dim(`⚡ [kylrix exec] Injected ${varCount} zero-leak variable(s) from "${resolved.name || idOrUrl}" into process RAM`));

    // Transient memory allocation for child process env
    const childEnv = { ...process.env, ...resolved.variables };
    const [bin, ...args] = commandArgs;

    const child = spawn(bin, args, {
      stdio: 'inherit',
      env: childEnv,
      shell: true,
    });

    child.on('exit', (code, signal) => {
      // Zero out local variables in memory upon process termination
      for (const key of Object.keys(resolved.variables)) {
        (childEnv as any)[key] = '';
        (resolved.variables as any)[key] = '';
        delete (childEnv as any)[key];
        delete (resolved.variables as any)[key];
      }

      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });
  } catch (err: any) {
    printError(`Failed to execute process wrapper with secret "${idOrUrl}"`, err);
    process.exit(1);
  }
}
