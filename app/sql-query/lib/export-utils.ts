/**
 * Streaming CSV export for large datasets
 * Exports data in chunks to avoid memory issues
 */

/**
 * Export results to CSV with streaming for large datasets
 * @param results - Array of result objects
 * @param filename - Output filename
 * @param chunkSize - Number of rows per chunk
 */
export async function exportToCSV(
    results: Record<string, unknown>[],
    filename: string = 'query_results.csv',
    chunkSize: number = 10000
): Promise<void> {
    if (results.length === 0) return

    const columns = Object.keys(results[0])

    // Create CSV header
    const header = columns.map(col => `"${col}"`).join(',') + '\n'

    // For small datasets, use simple approach
    if (results.length < chunkSize) {
        const csv = header + results.map(row =>
            columns.map(col => {
                const val = row[col]
                if (val === null || val === undefined) return '""'
                const str = String(val).replace(/"/g, '""')
                return `"${str}"`
            }).join(',')
        ).join('\n')

        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
        return
    }

    // For large datasets, use chunked approach
    const chunks: string[] = [header]

    for (let i = 0; i < results.length; i += chunkSize) {
        const chunk = results.slice(i, i + chunkSize)
        const csvChunk = chunk.map(row =>
            columns.map(col => {
                const val = row[col]
                if (val === null || val === undefined) return '""'
                const str = String(val).replace(/"/g, '""')
                return `"${str}"`
            }).join(',')
        ).join('\n')

        chunks.push(csvChunk)

        // Allow UI to breathe
        await new Promise(resolve => setTimeout(resolve, 0))
    }

    const csv = chunks.join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

/**
 * Export results to JSON with streaming
 */
export async function exportToJSON(
    results: Record<string, unknown>[],
    filename: string = 'query_results.json',
    pretty: boolean = false
): Promise<void> {
    const json = pretty
        ? JSON.stringify(results, null, 2)
        : JSON.stringify(results)

    downloadBlob(
        new Blob([json], { type: 'application/json;charset=utf-8;' }),
        filename
    )
}

/**
 * Copy results to clipboard (with size limit)
 */
export async function copyToClipboard(
    results: Record<string, unknown>[],
    maxRows: number = 1000
): Promise<boolean> {
    try {
        const limited = results.slice(0, maxRows)
        const text = JSON.stringify(limited, null, 2)

        await navigator.clipboard.writeText(text)
        return true
    } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        return false
    }
}

/**
 * Helper function to trigger file download
 */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Estimate export size
 */
export function estimateExportSize(results: Record<string, unknown>[]): {
    sizeKB: number
    sizeMB: number
    rowCount: number
} {
    if (results.length === 0) {
        return { sizeKB: 0, sizeMB: 0, rowCount: 0 }
    }

    // Estimate based on first 100 rows
    const sample = results.slice(0, Math.min(100, results.length))
    const sampleSize = new Blob([JSON.stringify(sample)]).size
    const avgRowSize = sampleSize / sample.length
    const totalSize = avgRowSize * results.length

    return {
        sizeKB: Math.round(totalSize / 1024),
        sizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
        rowCount: results.length,
    }
}
