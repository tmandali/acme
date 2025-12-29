"use client"

import * as React from "react"
import DataEditor, {
    GridCell,
    GridCellKind,
    GridColumn,
    Item,
    Theme,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import { useTheme } from "next-themes"
import {
    Maximize2,
    Minimize2,
    Download,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTime } from "./results-table-utils"
import { ResultsTableProps } from "./results-table-types"

/**
 * High-performance data grid using Glide Data Grid
 * Optimized for large datasets with Excel-like experience
 */
export function ResultsTableGlide({
    results,
    isLoading,
    executionTime,
    queryStatus,
    isFullscreen = false,
    onToggleFullscreen
}: ResultsTableProps) {
    const { theme } = useTheme()
    const [elapsedTime, setElapsedTime] = React.useState(0)
    const startTimeRef = React.useRef<number | null>(null)
    const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({})

    // Update column widths state when results change (reset or initialize)
    React.useEffect(() => {
        if (results.length > 0) {
            const initialWidths: Record<string, number> = {}
            Object.keys(results[0]).forEach(key => {
                initialWidths[key] = 150 // Default width
            })
            // Only set if we haven't manually resized yet or if the keys changed significantly
            setColumnWidths(prev => {
                const resultsKeys = Object.keys(results[0])
                const hasSameKeys = resultsKeys.every(k => k in prev)
                return hasSameKeys ? prev : initialWidths
            })
        }
    }, [results.length > 0 ? Object.keys(results[0]).join(",") : ""])

    const onColumnResize = React.useCallback((column: GridColumn, newSize: number) => {
        setColumnWidths(prev => ({
            ...prev,
            [column.id || ""]: newSize
        }))
    }, [])

    // Timer for loading state
    React.useEffect(() => {
        if (isLoading) {
            startTimeRef.current = Date.now()
            setElapsedTime(0)
            const interval = setInterval(() => {
                if (startTimeRef.current) {
                    setElapsedTime(Date.now() - startTimeRef.current)
                }
            }, 100)
            return () => clearInterval(interval)
        } else {
            startTimeRef.current = null
        }
    }, [isLoading])

    // Extract column names from first result
    const columns = React.useMemo((): GridColumn[] => {
        if (results.length === 0) return []

        const firstRow = results[0]
        return Object.keys(firstRow).map((key) => ({
            id: key,
            title: key,
            width: columnWidths[key] || 150,
            grow: 1,
        }))
    }, [results.length > 0 ? Object.keys(results[0]).join(",") : "", columnWidths])

    // Get cell content
    const getCellContent = React.useCallback(
        (cell: Item): GridCell => {
            const [col, row] = cell
            const dataRow = results[row]
            const columnId = columns[col]?.id

            if (!dataRow || !columnId) {
                return {
                    kind: GridCellKind.Text,
                    data: "",
                    displayData: "",
                    allowOverlay: false,
                }
            }

            const value = dataRow[columnId]

            // Handle different data types
            if (value === null || value === undefined) {
                return {
                    kind: GridCellKind.Text,
                    data: "",
                    displayData: "NULL",
                    allowOverlay: false,
                    contentAlign: "center",
                    themeOverride: {
                        textLight: "#94a3b8",
                        textDark: "#64748b",
                    },
                }
            }

            if (typeof value === "number") {
                return {
                    kind: GridCellKind.Number,
                    data: value,
                    displayData: value.toString(),
                    allowOverlay: false,
                }
            }

            if (typeof value === "boolean") {
                return {
                    kind: GridCellKind.Boolean,
                    data: value,
                    allowOverlay: false,
                }
            }

            // Default to text
            const displayValue = String(value)
            return {
                kind: GridCellKind.Text,
                data: displayValue,
                displayData: displayValue,
                allowOverlay: false,
            }
        },
        [results, columns]
    )

    // Custom theme based on current theme
    const customTheme = React.useMemo((): Partial<Theme> => {
        const isDark = theme === "dark"

        return {
            // Modern, premium accent color
            accentColor: isDark ? "#60a5fa" : "#3b82f6",
            accentLight: isDark ? "rgba(96, 165, 250, 0.1)" : "rgba(59, 130, 246, 0.05)",

            // Text colors for high readability
            textDark: isDark ? "#fafafa" : "#171717",
            textMedium: isDark ? "#a3a3a3" : "#525252",
            textLight: isDark ? "#737373" : "#737373",
            textBubble: isDark ? "#fafafa" : "#171717",

            // Colors for icons and headers
            bgIconHeader: isDark ? "#a3a3a3" : "#525252",
            fgIconHeader: isDark ? "#0a0a0a" : "#ffffff",
            textHeader: isDark ? "#fafafa" : "#404040",
            textHeaderSelected: isDark ? "#ffffff" : "#000000",

            // Background colors
            bgCell: isDark ? "#0a0a0a" : "#ffffff",
            bgCellMedium: isDark ? "#141414" : "#fafafa", // Light mode striping matches background
            bgHeader: isDark ? "#141414" : "#f5f5f5", // Header slightly darker in light mode
            bgHeaderHasFocus: isDark ? "#262626" : "#e5e5e5",
            bgHeaderHovered: isDark ? "#262626" : "#e5e5e5",

            // Borders (very subtle)
            borderColor: isDark ? "#262626" : "#e5e5e5",
            horizontalBorderColor: isDark ? "#1a1a1a" : "#f0f0f0",

            // Selection and focus
            accentFg: isDark ? "#0a0a0a" : "#ffffff",

            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            headerFontStyle: "600 12px",
            baseFontStyle: "12px",
            editorFontSize: "12px",
        }
    }, [theme])

    // Export to CSV
    const handleExport = React.useCallback(() => {
        if (results.length === 0) return

        const headers = Object.keys(results[0])
        const csvContent = [
            headers.join(","),
            ...results.map(row =>
                headers.map(header => {
                    const value = row[header]
                    if (value === null || value === undefined) return ""
                    const stringValue = String(value)
                    // Escape quotes and wrap in quotes if contains comma
                    if (stringValue.includes(",") || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`
                    }
                    return stringValue
                }).join(",")
            )
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `query-results-${Date.now()}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [results])

    // Render loading state
    if (isLoading && results.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Sorgu çalıştırılıyor...</p>
                <p className="text-xs text-muted-foreground mt-2">
                    {formatTime(elapsedTime)}
                </p>
            </div>
        )
    }

    // Render empty state
    if (!isLoading && queryStatus === null && results.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">
                    Sonuç görmek için bir sorgu çalıştırın
                </p>
            </div>
        )
    }

    // Render cancelled state (only if no data)
    if (queryStatus === "cancelled" && results.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background">
                <XCircle className="h-12 w-12 text-destructive/50 mb-4" />
                <p className="text-sm text-muted-foreground">Sorgu iptal edildi</p>
            </div>
        )
    }

    // Render main grid
    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-3 h-8 border-b bg-muted/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 pr-3 border-r">
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        ) : queryStatus === "completed" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : queryStatus === "cancelled" ? (
                            <XCircle className="h-3 w-3 text-destructive" />
                        ) : null}

                        <span className="text-[11px] font-semibold tracking-tight">
                            {results.length.toLocaleString("tr-TR")}
                            <span className="text-muted-foreground ml-1 font-normal">satır</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px]">
                        {executionTime !== null && executionTime !== undefined && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3 opacity-70" />
                                {formatTime(executionTime)}
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex items-center gap-1 text-blue-500 font-medium">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                {formatTime(elapsedTime)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-0.5">
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={handleExport}
                        disabled={results.length === 0}
                        className="text-[10px] font-medium"
                    >
                        <Download className="size-3 mr-1 opacity-70" />
                        CSV
                    </Button>

                    <div className="w-[1px] h-3 bg-border mx-1" />

                    {onToggleFullscreen && (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={onToggleFullscreen}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="size-3 opacity-70" />
                            ) : (
                                <Maximize2 className="size-3 opacity-70" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-hidden">
                {results.length > 0 && (
                    <DataEditor
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={results.length}
                        onColumnResize={onColumnResize}
                        theme={customTheme}
                        width="100%"
                        height="100%"
                        smoothScrollX={true}
                        smoothScrollY={true}
                        rowMarkers="number"
                        freezeColumns={0}
                        getCellsForSelection={true}
                        rowHeight={26}
                        headerHeight={26}
                        // Enable copy/paste
                        onPaste={false}
                        // Custom styling
                        className="glide-data-grid-custom"
                    />
                )}
            </div>
        </div>
    )
}
