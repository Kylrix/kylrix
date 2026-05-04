import { format, formatDistanceToNowStrict, isValid } from 'date-fns';

const TIME_FORMAT = 'MMM d, h:mm a';

const toDate = (value: string | number | Date | null | undefined) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isValid(date) ? date : null;
};

export const formatPostTimestamp = (
    createdAt: string | number | Date | null | undefined,
    updatedAt?: string | number | Date | null | undefined,
) => {
    const created = toDate(createdAt);
    if (!created) return '';

    const exactCreated = format(created, TIME_FORMAT);
    const ageSuffix = formatDistanceToNowStrict(created, { addSuffix: true, roundingMethod: 'floor' });
    const relativeWindow = Math.abs(Date.now() - created.getTime()) < 1000 * 60 * 60 * 24 * 30;

    let label = relativeWindow ? `${ageSuffix} · ${exactCreated}` : exactCreated;

    const updated = toDate(updatedAt);
    if (updated && Math.abs(updated.getTime() - created.getTime()) > 60_000) {
        label += ` · Edited ${format(updated, TIME_FORMAT)}`;
    }

    return label;
};
