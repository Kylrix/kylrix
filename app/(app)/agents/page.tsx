import { AgentsClient } from '@/components/app/AgentsClient';
import { listMyAgents } from '@/lib/actions/agentic';
import { getActor } from '@/lib/actions/secure-ops';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  // Parallel Fetch: Auth check + Initial data
  const actor = await getActor();
  if (!actor) {
    redirect('/accounts/login');
  }

  const agents = await listMyAgents();

  return <AgentsClient initialAgents={JSON.parse(JSON.stringify(agents))} />;
}
