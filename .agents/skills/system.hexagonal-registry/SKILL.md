---
name: system.hexagonal-registry
description: Deep dive into the dynamic Dependency Injection (DI) registry in Kylrix. Explains port/adapter decoupling, lazy instantiation, and run-time mock overrides for testing.
---

# Why: Hexagonal Registry & Swappable Dependency Injection

Under a traditional architecture, code imports database drivers and SDKs directly. This tight coupling makes it very difficult to switch database backends, write clean unit tests, or run local mock environments without spawning live databases.

We decouple these dependencies using the **Dependency Injection (DI) Registry** in `lib/core/di/registry.ts`. North-star rationale: **`kylrix`** skill (anti-fragility, bare-metal end state).

## 1. Clean decoupling with Ports and Adapters

Instead of components depending directly on specific packages (like the Appwrite SDK), they interact only with abstract Port definitions (e.g., `DatabasePort`, `StoragePort`):

```typescript
import { DatabasePort } from '../ports/database.port';
import { Registry } from '@/lib/core/di/registry';

// Usage in business logic:
const database = Registry.getDatabase();
await database.getRow({ databaseId, tableId, rowId });
```

The concrete implementation is hidden inside an Adapter (e.g., `AppwriteDatabaseAdapter`) that implements the Port's interface.

## 2. Lazy Instantiation & Memory Efficiency

To keep the application fast and avoid allocating memory for unused adapters, the Registry instantiates adapters only when they are first requested:

```typescript
private static db: DatabasePort | null = null;

static getDatabase(): DatabasePort {
  if (!this.db) {
    this.db = new AppwriteDatabaseAdapter();
  }
  return this.db;
}
```

## 3. Dynamic Runtime Overrides for Testing

The Registry includes explicit override hooks (`overrideDatabase`, `overrideAuth`, etc.):

```typescript
static overrideDatabase(customDb: DatabasePort): void {
  this.db = customDb;
}
```

This lets us mock the database layer easily in our test suite (`lib/core/core.test.ts`) by injecting an in-memory mock adapter. We can run our tests in milliseconds without needing a live network connection or database.
