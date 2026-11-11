import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShareLockButton } from './ShareLockButton';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/context/UnifiedDrawerContext', () => ({
  useUnifiedDrawer: () => ({
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('@/context/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { $id: 'user_123', email: 'test@kylrix.org' },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}));

vi.mock('@/lib/utils', () => ({
  hasPaidKylrixPlan: () => true,
}));

describe('ShareLockButton Component', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders muted/subtle styles when unshared (isPublic=false, isGuest=false)', async () => {
    await act(async () => {
      root.render(
        <ShareLockButton
          resourceType="note"
          resourceId="note_1"
          isPublic={false}
          isGuest={false}
          accentColor="#6366F1"
        />
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Share publicly');
    expect(button?.style.color).toBe('rgba(255, 255, 255, 0.4)');
    expect(button?.style.backgroundColor).toBe('transparent');
  });

  it('renders vibrant accentColor and tint when isPublic=true even if isGuest=false', async () => {
    await act(async () => {
      root.render(
        <ShareLockButton
          resourceType="goal"
          resourceId="goal_1"
          isPublic={true}
          isGuest={false}
          accentColor="#A855F7"
        />
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Copy public link');
    expect(button?.style.color).toBe('#A855F7');
  });

  it('renders vibrant accentColor and tint when isGuest=true even if isPublic=false', async () => {
    await act(async () => {
      root.render(
        <ShareLockButton
          resourceType="totp"
          resourceId="totp_1"
          isPublic={false}
          isGuest={true}
          accentColor="#10B981"
        />
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Copy public link');
    expect(button?.style.color).toBe('#10B981');
  });

  it('reactively turns into active/colored state when kylrix:share-published event fires', async () => {
    await act(async () => {
      root.render(
        <ShareLockButton
          resourceType="credential"
          resourceId="cred_123"
          isPublic={false}
          isGuest={false}
          accentColor="#6366F1"
        />
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Share publicly');
    expect(button?.style.color).toBe('rgba(255, 255, 255, 0.4)');

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('kylrix:share-published', {
          detail: {
            resourceType: 'credential',
            resourceId: 'cred_123',
            ok: true,
          },
        })
      );
    });

    expect(button?.getAttribute('aria-label')).toBe('Copy public link');
    expect(button?.style.color).toBe('#6366F1');
  });
});
