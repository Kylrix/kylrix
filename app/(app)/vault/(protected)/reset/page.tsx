import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const MasterpassResetClient = dynamic(() => import('./reset-client'), { ssr: false });

export default function MasterpassResetPage() {
  return <MasterpassResetClient />;
}
