// Utility functions for ResultsTable component

/**
 * Formats milliseconds into a human-readable time string
 * @param ms - Time in milliseconds
 * @returns Formatted time string (e.g., "1sa 30dk 45sn")
 */
export function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`

    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const msRemainder = ms % 1000

    const parts: string[] = []
    if (h > 0) parts.push(`${h}sa`)
    if (m > 0 || h > 0) parts.push(`${m}dk`)
    parts.push(`${s}sn`)
    if (msRemainder > 0 && h === 0) parts.push(`${msRemainder}ms`)

    return parts.join(" ")
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
