export type SecurityConfirmFlow = 'vault-wipe' | 'change-password';

export interface SecurityConfirmStep {
  id: string;
  stepLabel: string;
  title: string;
  description: string;
  bullets?: string[];
  checkboxLabel?: string;
  confirmLabel: string;
  tone: 'warning' | 'danger' | 'neutral';
}

export const VAULT_WIPE_STEPS: SecurityConfirmStep[] = [
  {
    id: 'vault-wipe-scope',
    stepLabel: 'Step 1 of 3',
    title: 'Reset vault?',
    description: 'This starts a permanent wipe of your encrypted vault. Nothing in this flow can be undone later.',
    bullets: [
      'Saved passwords and logins',
      'TOTP codes and secure notes',
      'Vault identities tied to this account',
    ],
    confirmLabel: 'I understand the scope',
    tone: 'warning',
  },
  {
    id: 'vault-wipe-loss',
    stepLabel: 'Step 2 of 3',
    title: 'Data will be destroyed',
    description: 'Wiped secrets are removed from your account and cannot be restored from backups on our side.',
    checkboxLabel: 'I accept that all vault data will be permanently lost',
    confirmLabel: 'Continue',
    tone: 'danger',
  },
  {
    id: 'vault-wipe-final',
    stepLabel: 'Step 3 of 3',
    title: 'Last confirmation',
    description: 'After this step you will verify your identity before the wipe runs.',
    checkboxLabel: 'I want to reset my vault and wipe all encrypted data',
    confirmLabel: 'Proceed to identity check',
    tone: 'danger',
  },
];

export const CHANGE_PASSWORD_STEPS: SecurityConfirmStep[] = [
  {
    id: 'password-change-impact',
    stepLabel: 'Step 1 of 2',
    title: 'Change vault password?',
    description: 'Your new password re-wraps every secret in the vault. You will need it on every device.',
    bullets: [
      'All saved passwords are re-encrypted',
      'Active sessions may need to unlock again',
      'Choose a password you can store safely',
    ],
    confirmLabel: 'I understand',
    tone: 'warning',
  },
  {
    id: 'password-change-ready',
    stepLabel: 'Step 2 of 2',
    title: 'Ready to continue?',
    description: 'Next you will verify your current vault password before setting a new one.',
    checkboxLabel: 'I have my new password ready and stored somewhere safe',
    confirmLabel: 'Proceed to identity check',
    tone: 'neutral',
  },
];

export function getSecurityConfirmSteps(flow: SecurityConfirmFlow): SecurityConfirmStep[] {
  return flow === 'vault-wipe' ? VAULT_WIPE_STEPS : CHANGE_PASSWORD_STEPS;
}
