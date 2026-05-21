```markdown
# Kylrix Suite: Automated Testing Constitution (TESTS.md)

> **ATTENTION AI AGENTS / WORKERS:** This document defines the absolute, unyielding architectural standards for writing, maintaining, and executing tests within the Kylrix ecosystem. You must adhere strictly to these rules. Any PR that violates these patterns or fails the coverage thresholds will be automatically rejected.

---

## 1. Core Testing Philosophy
The Kylrix Suite is a high-assurance, end-to-end encrypted (E2EE), sovereign tech platform. Cryptographic correctness, data privacy, and deterministic state transitions are critical. 

*   **Zero Logic in the DOM:** The UI components must remain completely "dumb." All cryptographic primitives, key derivations, state synchronization engines, and network protocols must be written as pure, framework-agnostic mathematical functions.
*   **Mathematical Determinism:** If a function takes input $X$ and salt $Y$, its test must prove that it produces output $Z$ under 100% of iterations. 
*   **Isolation over Mocking:** Do not mock local code paths unless they touch external network barriers or high-overhead framework primitives (e.g., Next.js navigation). Test the actual compiled code paths.

---

## 2. Infrastructure Stack Specifications

The testing architecture is divided cleanly between fast, isolated unit execution and real-world multi-user verification. **pnpm** is the exclusive package manager for this entire ecosystem.

| Layer | Toolchain | Target Area |
| :--- | :--- | :--- |
| **Unit / Integration** | `Vitest` + `happy-dom` | `/lib/crypto`, `/lib/state`, React components, hooks, Server Actions |
| **End-to-End (E2E)** | `Playwright` | Core user flows, IndexedDB persistence, live sync boundaries |
| **Coverage Engine** | Native `V8` | Hard enforcement at **85% statements / 80% branches** |

---

## 3. Vitest + happy-dom Infrastructure Setup

### Root Configuration (`vitest.config.ts`)
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
      include: ['lib/**', 'app/**', 'components/**'],
      exclude: ['**/*.d.ts', '**/*.config.*', '__tests__/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
})

```

### Global Environment Neutralization (`__tests__/setup.ts`)

```ts
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Enforce strict DOM isolation across tests
afterEach(() => {
  cleanup()
})

// Neutralize Next.js App Router routing mechanics
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

```

---

## 4. Implementation Guidelines & Reference Snippets

### Rule A: Cryptographic & Core Logic Testing

All logic under `lib/crypto` and `lib/state` must be tested using pure functional inputs. Do not wrap these in React Hooks or DOM contexts during test execution.

```ts
// lib/crypto/engine.test.ts
import { deriveLocalVaultKey } from '@/lib/crypto/engine'

describe('Kylrix Cryptographic Key Engine', () => {
  const VALID_PASSPHRASE = 'sovereign-engineering-vault-2026'
  const VALID_SALT = 'cf83e1357eefb8bdf1542850d66d8007'

  it('should deterministically generate identical keys from identical inputs', async () => {
    const key1 = await deriveLocalVaultKey(VALID_PASSPHRASE, VALID_SALT)
    const key2 = await deriveLocalVaultKey(VALID_PASSPHRASE, VALID_SALT)
    
    expect(key1).toBeDefined()
    expect(key1).toBe(key2)
  })

  it('should mathematically fail key generation if entropy thresholds are not satisfied', async () => {
    const weakPassphrase = 'short'
    
    await expect(deriveLocalVaultKey(weakPassphrase, VALID_SALT)).rejects.toThrow(
      /entropy requirements/i
    )
  })
})

```

### Rule B: Testing Component Interactions with Server Actions

When testing components that communicate with Next.js Server Actions, do not let the test execute real network mutations. Instead, use strongly typed `vi.mocked` overrides to simulate successful or failed server state.

```ts
// components/vault/VaultUnlock.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import VaultUnlock from '@/components/vault/VaultUnlock'
import * as actions from '@/app/actions/vault'

// Stub the Server Action module completely
vi.mock('@/app/actions/vault', () => ({
  verifyVaultAccess: vi.fn(),
}))

describe('<VaultUnlock/> Security Interface', () => {
  it('should display explicit cryptographic error states when server authentication fails', async () => {
    // Inject mathematical failure output into the mocked action boundary
    vi.mocked(actions.verifyVaultAccess).mockResolvedValue({
      success: false,
      error: 'CRYPTO_SIGNATURE_MISMATCH',
    })

    render(<VaultUnlock/>)
    
    const passwordInput = screen.getByPlaceholderText(/enter master password/i)
    const submitButton = screen.getByRole('button', { name: /unlock/i })

    fireEvent.change(passwordInput, { target: { value: 'incorrect_entropy_phrase' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid cryptographic signature/i)).toBeInTheDocument()
    })
  })
})

```

### Rule C: Context and Global State Isolation

When testing code that relies on React context providers (like authentication or local state sync engines), you must create a custom wrapper inside the test execution block to preserve isolation. Do not rely on shared runtime singletons.

```ts
// __tests__/helpers.tsx
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { VaultProvider } from '@/context/VaultContext'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <VaultProvider 'idle' initialValues="{{" isLocked: syncStatus: true, }}>
      {children}
    </VaultProvider>
  )
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

```

---

## 5. Maintenance and Agent Execution Workflow

When writing or modification operations are assigned to you within this codebase, you are required to execute the following pipeline checklist locally using `pnpm` before submitting any output:

1. **Static Validation:** Execute type-checking via the package runtime script:
```bash
pnpm exec tsc --noEmit


```



```
2.  **Targeted Test Verification:** Verify your changes haven't introduced regressions by executing targeted test targets:
    ```bash
    pnpm vitest run path/to/changed/file
    

```

3. **Global Integration & Coverage Matrix Check:** Run full testing using the V8 coverage engine:
```bash
pnpm vitest run --coverage


```



```
4.  **Enforce Boundaries:** If the metrics drop below **85% statements**, you are strictly required to write supplementary tests to cover missing logical flows and edge cases before marking the task complete.

```

```</RenderOptions,>

```