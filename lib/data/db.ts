import { Registry } from '@/lib/core/di/registry';
import type { DatabaseRepository } from '@/lib/db/repository';

/** Hexagonal database port (backend-agnostic). */
export function getDatabase(): DatabaseRepository {
  return Registry.getDatabase();
}

export { Registry };
