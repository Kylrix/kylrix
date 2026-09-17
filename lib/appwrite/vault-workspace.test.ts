import { describe, it, expect } from 'vitest';
import { COLLECTION_SCHEMAS } from './vault-service';

describe('Vault Schemas and Workspace Object Mapping', () => {
  it('does not include projectId or isWorkspace in credentials schema', () => {
    const credFields = COLLECTION_SCHEMAS.credentials.plaintext;
    expect(credFields).not.toContain('projectId');
    expect(credFields).not.toContain('isWorkspace');
  });

  it('does not include projectId or isWorkspace in totpSecrets schema', () => {
    const totpFields = COLLECTION_SCHEMAS.totpSecrets.plaintext;
    expect(totpFields).not.toContain('projectId');
    expect(totpFields).not.toContain('isWorkspace');
  });
});
