import { createMomentOpenGraphImage, MOMENT_OG_SIZE } from '@/lib/connect/moment-og';

export const alt = 'Kylrix Connect moment preview';
export const size = MOMENT_OG_SIZE;
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function Image(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    return createMomentOpenGraphImage(id);
}
