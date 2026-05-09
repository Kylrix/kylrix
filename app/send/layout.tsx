import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Send · Kylrix',
  description:
    'Share notes, passwords, tasks, TOTP seeds, and files with expiring links. Recipients need no account.',
};

export default function SendLayout({ children }: { children: React.ReactNode }) {
  return children;
}
