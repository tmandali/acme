import type { RecordBatch } from "apache-arrow"

/**
 * TableData can be either a flat array of objects (legacy)
 * or an array of Apache Arrow RecordBatches (high performance)
 */
export type TableData = Record<string, any>[] | RecordBatch[]

export interface ResultsTableProps {
    results: TableData
    totalRows?: number
    isLoading: boolean
    executionTime?: number
    queryStatus?: "completed" | "cancelled" | null
    isFullscreen?: boolean
    onToggleFullscreen?: () => void
}
