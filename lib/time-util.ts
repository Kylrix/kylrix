/**
 * Light-weight time utilities to replace date-fns.
 * Reduces bundle size by using native Intl.DateTimeFormat and Math.
 */

function isValidDate(date: any): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
}


const DEFAULT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
};

export function formatTime(date: Date | string | number, options: Intl.DateTimeFormatOptions = DEFAULT_TIME_FORMAT): string {
    const d = typeof date === 'object' ? date : new Date(date);
    if (!isValidDate(d)) return '';
    return new Intl.DateTimeFormat('en-US', options).format(d);
}















export function addHours(date: Date, amount: number): Date {
    const d = new Date(date);
    d.setHours(d.getHours() + amount);
    return d;
}
