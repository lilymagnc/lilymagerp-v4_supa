/**
 * Date parsing utility for handling ISO strings and Date objects
 */

/**
 * Safely parse a date from various formats
 * Handles:
 * - ISO date strings (Supabase)
 * - JavaScript Date objects
 * - Unix timestamps (seconds or milliseconds)
 */
export function parseDate(date: any): Date | null {
    if (!date) return null;

    // Already a Date object
    if (date instanceof Date) return date;

    // ISO string or common string format
    if (typeof date === 'string') {
        // Try parsing directly
        let parsed = new Date(date);

        // If failed, try replacing space with T for ISO-ish strings
        if (isNaN(parsed.getTime()) && date.includes(' ')) {
            const isoLike = date.replace(' ', 'T');
            parsed = new Date(isoLike);
        }

        // If still failed, try parsing "YYYY-MM-DD" part only
        if (isNaN(parsed.getTime())) {
            const datePart = date.split(' ')[0];
            if (datePart.includes('-')) {
                parsed = new Date(datePart);
            }
        }

        return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Unix timestamp (number)
    if (typeof date === 'number') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

/**
 * Format a date value to ISO string for Supabase
 */
export function toISOString(date: any): string | null {
    const parsed = parseDate(date);
    return parsed ? parsed.toISOString() : null;
}

/**
 * Format a date value to local date string
 */
export function toLocaleDateString(date: any, locale: string = 'ko-KR'): string {
    const parsed = parseDate(date);
    return parsed ? parsed.toLocaleDateString(locale) : '-';
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: any): boolean {
    const parsed = parseDate(date);
    return parsed !== null && !isNaN(parsed.getTime());
}
