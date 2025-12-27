// Type definitions for ResultsTable component

export interface ResultsTableProps {
    results: Record<string, unknown>[]
    isLoading: boolean
    executionTime?: number
    queryStatus?: "completed" | "cancelled" | null
    isFullscreen?: boolean
    onToggleFullscreen?: () => void
}
