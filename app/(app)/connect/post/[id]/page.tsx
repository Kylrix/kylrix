import { redirect } from 'next/navigation';

export default async function PostView(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    redirect(`/moment/${id}`);
}
