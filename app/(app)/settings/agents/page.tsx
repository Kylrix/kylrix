import { redirect } from 'next/navigation';

export default function AssistantSettingsPage() {
  redirect('/settings?tab=agents');
}
