import { Registry } from '@/lib/core/di/registry';
import type { DatabasePort } from '@/lib/core/ports/database.port';

/** Hexagonal database port (backend-agnostic). */
export function getDatabase(): DatabasePort {
  return Registry.getDatabase();
}

export { Registry };
