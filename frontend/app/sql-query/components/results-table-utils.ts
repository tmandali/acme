import dayjs from "dayjs"
import duration from "dayjs/plugin/duration"
import utc from "dayjs/plugin/utc"
import prettyBytes from "pretty-bytes"

dayjs.extend(duration)
dayjs.extend(utc)

/**
 * Formats bytes into a human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g. "1.34 MB")
 */
export function formatBytes(bytes: number): string {
    return prettyBytes(bytes)
}

/**
 * Formats milliseconds into a time string
 * @param ms - Time in milliseconds
 * @param format - Optional format string (e.g. "HH:mm:ss.SSS") or null for human-readable default (e.g. "1sa 30dk")
 * @returns Formatted time string
 */
export function formatTime(ms: number, format: string | null = null): string {
    // Default 'human readable' behavior
    if (format === null) {
        if (ms < 1000) return `${ms}ms`

        const dur = dayjs.duration(ms)
        const h = Math.floor(dur.asHours()) // Use asHours to get total hours without wrapping
        const m = dur.minutes()
        const s = dur.seconds()
        const msRemainder = dur.milliseconds()

        const parts: string[] = []
        if (h > 0) parts.push(`${h}sa`)
        if (m > 0 || h > 0) parts.push(`${m}dk`)
        parts.push(`${s}sn`)
        if (msRemainder > 0 && h === 0) parts.push(`${msRemainder}ms`)

        return parts.join(" ")
    }

    // Custom format using dayjs
    // We use UTC to treat 'ms' as time elapsed since epoch 0, avoiding timezone offsets
    // Note: For durations > 24h, tokens like HH will wrap. For strict duration formatting >24h, 
    // a specialized duration-format plugin would be needed, but standard format works for typical times.
    // If the user manually asks for "SSS" (milliseconds), dayjs supports it.
    return dayjs.utc(ms).format(format)
}

/**
 * Extracts stable schema keys from results
 * @param results - Array of result objects
 * @returns Comma-separated string of keys or empty string
 */
export function getSchemaKeys(results: Record<string, unknown>[]): string {
    if (results.length === 0) return ""
    return Object.keys(results[0]).join(",")
}

/**
 * Creates a stable row ID
 * @param index - Row index
 * @returns String row ID
 */
export function getRowId(row: Record<string, unknown>, index: number): string {
    return String(index)
}

/**
 * Formats a value as a date if it looks like a date or timestamp
 * @param value - The value to format
 * @returns Formatted date string or the original value
 */
export function formatDate(value: any): string {
    if (value === null || value === undefined) return "";

    // 1. Handle ISO strings (e.g. 2006-07-11T04:18:23.883762 or 2006-07-11)
    if (typeof value === "string") {
        // ISO-like with Time
        if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return formatToHuman(date);
            }
        }

        // Simple Date: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const d = String(date.getDate()).padStart(2, "0");
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const y = date.getFullYear();
                return `${d}.${m}.${y}`;
            }
        }

        // Handle YYYYMMDD string format if needed
        if (/^\d{8}$/.test(value)) {
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            const date = new Date(`${year}-${month}-${day}`);
            if (!isNaN(date.getTime())) {
                return `${day}.${month}.${year}`;
            }
        }
    }

    // 2. Handle numeric timestamps
    if (typeof value === "number") {
        // Heuristic: values > 10^12 are usually ms timestamps (2001+)
        // values between 10^9 and 10^10 are usually seconds (1970 - 2286)
        if (value > 1000000000000 && value < 4000000000000) {
            return formatToHuman(new Date(value));
        } else if (value > 1000000000 && value < 4000000000) {
            return formatToHuman(new Date(value * 1000));
        }
    }

    return String(value);
}

function formatToHuman(date: Date): string {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");

    return `${d}.${m}.${y} ${h}:${min}:${s}`;
}
