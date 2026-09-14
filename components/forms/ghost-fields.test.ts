import { describe, it, expect } from 'vitest';
import {
  GHOST_FIELDS_REGISTRY,
  getEnabledGhostFields,
  resolveGhostFields,
} from '@/lib/forms/ghost-fields';

describe('Modular Ghost Fields Registry & Telemetry Resolver', () => {
  it('defines mandatory ghost fields in registry', () => {
    expect(GHOST_FIELDS_REGISTRY.subscription_tier).toBeDefined();
    expect(GHOST_FIELDS_REGISTRY.mfa_status).toBeDefined();
    expect(GHOST_FIELDS_REGISTRY.client_environment).toBeDefined();
    expect(GHOST_FIELDS_REGISTRY.user_locale).toBeDefined();
    expect(GHOST_FIELDS_REGISTRY.identity_id).toBeDefined();
  });

  it('correctly extracts enabled ghost fields from form settings', () => {
    expect(getEnabledGhostFields(null)).toEqual([]);
    expect(getEnabledGhostFields('')).toEqual([]);

    const jsonSettings = JSON.stringify({
      ghostFields: ['subscription_tier', 'mfa_status', 'invalid_key'],
    });
    expect(getEnabledGhostFields(jsonSettings)).toEqual(['subscription_tier', 'mfa_status']);

    const objectSettings = {
      ghostFields: ['client_environment', 'user_locale'],
    };
    expect(getEnabledGhostFields(objectSettings)).toEqual(['client_environment', 'user_locale']);
  });

  it('resolves ghost telemetry values for enabled fields', async () => {
    const mockUser = {
      $id: 'user_123',
      isPro: true,
      prefs: { currentTier: 'PRO', mfaEnabled: true },
    };

    const enabledKeys = ['subscription_tier', 'mfa_status', 'identity_id'];
    const resolved = await resolveGhostFields(enabledKeys, mockUser);

    expect(resolved.subscription_tier).toBe('PRO');
    expect(resolved.mfa_status).toBe('Enabled');
    expect(resolved.identity_id).toBe('user_123');
  });

  it('handles guest submitters gracefully', async () => {
    const enabledKeys = ['subscription_tier', 'mfa_status', 'identity_id'];
    const resolved = await resolveGhostFields(enabledKeys, null);

    expect(resolved.subscription_tier).toBe('Anonymous / Guest');
    expect(resolved.mfa_status).toBe('N/A (Guest)');
    expect(resolved.identity_id).toBe('Anonymous');
  });
});
