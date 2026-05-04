import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/accounts/settings/profile');
}
