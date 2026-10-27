import { describe, test, expect } from 'vitest';

describe('Porter Vault Export Decryption Benchmark', () => {
  const mockGetVaultItem = async (id: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return { id, name: `Decrypted Credential ${id}`, password: `secret-${id}` };
  };

  const decryptSequential = async (creds: { id: string }[], latencyMs: number) => {
    const decrypted: any[] = [];
    for (const row of creds) {
      const id = row?.id;
      if (!id) continue;
      try {
        decrypted.push(await mockGetVaultItem(id, latencyMs));
      } catch {
        decrypted.push(row);
      }
    }
    return decrypted;
  };

  const decryptParallel = async (creds: { id: string }[], latencyMs: number) => {
    return await Promise.all(
      creds.map(async (row) => {
        const id = row?.id;
        if (!id) return row;
        try {
          return await mockGetVaultItem(id, latencyMs);
        } catch {
          return row;
        }
      })
    );
  };

  test('compares sequential vs Promise.all execution time for decrypting 10 vault items with simulated latency', async () => {
    const creds = Array.from({ length: 10 }, (_, i) => ({ id: `cred-${i + 1}` }));
    const latencyMs = 20;

    const startSeq = performance.now();
    const resultSeq = await decryptSequential(creds, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const resultPar = await decryptParallel(creds, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(resultSeq).toEqual(resultPar);
    expect(resultPar.length).toBe(10);
    expect(resultPar[0]).toEqual({ id: 'cred-1', name: 'Decrypted Credential cred-1', password: 'secret-cred-1' });

    console.log(`Sequential duration (${creds.length} items, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${creds.length} items, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
