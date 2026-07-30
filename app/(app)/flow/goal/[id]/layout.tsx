import type { Metadata } from 'next';

/** Metadata lives on canonical /goal/[id]. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Shared Goal | Kylrix Flow',
    description: 'Collaborate on tasks, milestones, and high-velocity goals.',
  };
}

export default function LegacyGoalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
