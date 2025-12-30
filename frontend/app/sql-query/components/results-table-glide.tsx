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
import { toast } from "sonner"
import { formatTime, formatDate } from "./results-table-utils"
import { ResultsTableProps } from "./results-table-types"
import type { RecordBatch } from "apache-arrow"

export function ResultsTableGlide({
    results,
    totalRows: propsTotalRows,
    isLoading,
    executionTime,
    queryStatus,
    error,
    executedQuery,
    connectionName,
    isFullscreen = false,
    onToggleFullscreen
}: ResultsTableProps) {
    const { theme } = useTheme()
    const [elapsedTime, setElapsedTime] = React.useState(0)
    const startTimeRef = React.useRef<number | null>(null)
    const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({})

    const isArrow = React.useMemo(() => {
        return results.length > 0 && 'numRows' in results[0];
    }, [results]);

    const rowCount = propsTotalRows ?? results.length;

    // Batch mapping for Arrow
    const batchInfo = React.useMemo(() => {
        if (!isArrow) return null;
        const batches = results as RecordBatch[];
        const offsets: number[] = [];
        let current = 0;
        for (const b of batches) {
            offsets.push(current);
            current += b.numRows;
        }
        return { offsets };
    }, [results, isArrow]);

    // Columns
    const columns = React.useMemo((): GridColumn[] => {
        if (rowCount === 0) return []

        let keys: string[] = [];
        if (isArrow) {
            keys = (results[0] as RecordBatch).schema.fields.map(f => f.name);
        } else {
            keys = Object.keys(results[0] || {});
        }

        return keys.map((key) => ({
            id: key,
            title: key,
            width: columnWidths[key] || 150,
            grow: 1,
        }))
    }, [rowCount, results, columnWidths, isArrow])

    const getCellContent = React.useCallback(
        (cell: Item): GridCell => {
            const [col, row] = cell
            const columnId = columns[col]?.id
            if (!columnId) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }

            let value: any = null;

            if (isArrow) {
                const offsets = batchInfo!.offsets;
                // Binary search for the correct batch
                let low = 0, high = offsets.length - 1;
                let batchIdx = 0;
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    if (offsets[mid] <= row) {
                        batchIdx = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
                const batch = (results as RecordBatch[])[batchIdx];
                const relIdx = row - offsets[batchIdx];
                value = batch.getChildAt(col)?.get(relIdx);
            } else {
                value = (results as any[])[row]?.[columnId];
            }

            if (value === null || value === undefined) {
                return {
                    kind: GridCellKind.Text,
                    data: "",
                    displayData: "NULL",
                    allowOverlay: false,
                    contentAlign: "center",
                    themeOverride: { textLight: "#94a3b8", textDark: "#64748b" },
                }
            }

            if (typeof value === "bigint") value = value.toString();

            const formatted = formatDate(value);
            return {
                kind: GridCellKind.Text,
                data: String(value),
                displayData: formatted,
                allowOverlay: true,
            }
        },
        [results, columns, isArrow, batchInfo]
    )

    const onColumnResize = React.useCallback((column: GridColumn, newSize: number) => {
        setColumnWidths(prev => ({ ...prev, [column.id || ""]: newSize }))
    }, [])

    React.useEffect(() => {
        if (isLoading) {
            startTimeRef.current = Date.now();
            setElapsedTime(0);
            const interval = setInterval(() => {
                if (startTimeRef.current) setElapsedTime(Date.now() - startTimeRef.current);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isLoading])

    const customTheme = React.useMemo((): Partial<Theme> => {
        const isDark = theme === "dark"
        return {
            accentColor: isDark ? "#60a5fa" : "#3b82f6",
            accentLight: isDark ? "rgba(96, 165, 250, 0.1)" : "rgba(59, 130, 246, 0.05)",
            textDark: isDark ? "#fafafa" : "#171717",
            textMedium: isDark ? "#a3a3a3" : "#525252",
            textLight: isDark ? "#737373" : "#737373",
            bgCell: isDark ? "#0a0a0a" : "#ffffff",
            bgHeader: isDark ? "#141414" : "#f5f5f5",
            borderColor: isDark ? "#262626" : "#e5e5e5",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            headerFontStyle: "600 12px",
            baseFontStyle: "12px",
        }
    }, [theme])

    const handleExport = React.useCallback(() => {
        // Simple CSV export (only from objects or limited arrow for now)
        // Optimization: For large Arrow results, this should probably happen on backend
        toast.info("CSV dışa aktarma büyük veri setleri için hazırlanıyor...");
    }, []);

    if (isLoading && rowCount === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Sorgu çalıştırılıyor...</p>
                <p className="text-xs text-muted-foreground mt-2">{formatTime(elapsedTime)}</p>
            </div>
        )
    }

    if (!isLoading && error) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background p-6 text-center">
                <XCircle className="h-12 w-12 text-red-500/50 mb-4" />
                <p className="text-sm text-foreground font-medium mb-2">Sorgu Hatası</p>
                <div className="max-w-2xl overflow-auto max-h-[200px] p-4 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200 rounded-md font-mono text-xs whitespace-pre-wrap border border-red-200 dark:border-red-900/50 mb-4">
                    {error}
                </div>

                {executedQuery && (
                    <div className="max-w-2xl w-full bg-muted/30 border rounded-md p-3 text-left">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">{connectionName || "Sorgu Detayı"}</p>
                        <code className="text-xs font-mono text-foreground/80 block whitespace-pre-wrap max-h-[150px] overflow-auto">
                            {executedQuery.length > 500 ? executedQuery.substring(0, 500) + "..." : executedQuery}
                        </code>
                    </div>
                )}
            </div>
        )
    }

    if (!isLoading && queryStatus === null && rowCount === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">Sonuç görmek için bir sorgu çalıştırın</p>
            </div>
        )
    }

    if (!isLoading && queryStatus === 'completed' && rowCount === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background p-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-4" />
                <p className="text-sm text-foreground font-medium">Sorgu Başarıyla Çalıştırıldı</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">İşlem tamamlandı, dönecek veri yok.</p>

                {executedQuery && (
                    <div className="max-w-2xl w-full bg-muted/30 border rounded-md p-3 mb-4">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">{connectionName || "Sorgu Detayı"}</p>
                        <code className="text-xs font-mono text-foreground/80 block whitespace-pre-wrap max-h-[150px] overflow-auto">
                            {executedQuery.length > 500 ? executedQuery.substring(0, 500) + "..." : executedQuery}
                        </code>
                    </div>
                )}

                {executionTime !== undefined && (
                    <p className="text-[10px] text-muted-foreground px-2 py-1 bg-muted rounded-full">
                        Süre: {formatTime(executionTime)}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="flex items-center justify-between px-3 h-8 border-b bg-muted/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 pr-3 border-r">
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        ) : (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        )}
                        <span className="text-[11px] font-semibold tracking-tight flex items-center">
                            <span>{rowCount.toLocaleString("tr-TR")}</span>
                            <span className="text-muted-foreground ml-1 font-normal">satır</span>

                            {!isLoading && executionTime !== undefined && (
                                <span className="flex items-center gap-1 ml-3 pl-3 border-l text-muted-foreground font-normal">
                                    <Clock className="h-3 w-3 opacity-60" />
                                    {formatTime(executionTime)}
                                </span>
                            )}

                            {isLoading && elapsedTime > 0 && (
                                <span className="flex items-center gap-1 ml-3 pl-3 border-l text-blue-500/70 font-normal">
                                    <Clock className="h-3 w-3 opacity-60 animate-pulse" />
                                    {formatTime(elapsedTime)}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-0.5">
                    <Button variant="outline" size="xs" onClick={handleExport} disabled={rowCount === 0} className="text-[10px] font-medium">
                        <Download className="size-3 mr-1 opacity-70" /> CSV
                    </Button>
                    {onToggleFullscreen && (
                        <Button variant="ghost" size="icon-xs" onClick={onToggleFullscreen}>
                            {isFullscreen ? <Minimize2 className="size-3 opacity-70" /> : <Maximize2 className="size-3 opacity-70" />}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {rowCount > 0 && (
                    <DataEditor
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={rowCount}
                        onColumnResize={onColumnResize}
                        theme={customTheme}
                        width="100%"
                        height="100%"
                        smoothScrollX={true}
                        smoothScrollY={true}
                        rowMarkers="number"
                        rowHeight={26}
                        headerHeight={26}
                    />
                )}
            </div>
        </div>
    )
}
