/**
 * Date parsing utility for handling both Firebase Timestamp and Supabase ISO strings
 */

/**
 * Safely parse a date from various formats
 * Handles:
 * - Firebase Timestamp objects
 * - ISO date strings (Supabase)
 * - JavaScript Date objects
 * - Unix timestamps (seconds or milliseconds)
 */
export function parseDate(date: any): Date | null {
    if (!date) return null;

    // Already a Date object
    if (date instanceof Date) return date;

    // ISO string (Supabase format)
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Firebase Timestamp with toDate method
    if (typeof date.toDate === 'function') {
        return date.toDate();
    }

    // Firebase Timestamp with seconds property
    if (date.seconds) {
        return new Date(date.seconds * 1000);
    }

    // Unix timestamp (number)
    if (typeof date === 'number') {
        // Assume milliseconds if > year 2000 in seconds
        const timestamp = date > 946684800 ? date * 1000 : date;
        return new Date(timestamp);
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
