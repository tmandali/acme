import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { processJinjaTemplate } from "../lib/utils"
import type { Variable } from "../lib/types"
import * as arrow from "apache-arrow"

interface UseQueryExecutionProps {
    variables: Variable[];
    sessionId: string;
}

export function useQueryExecution({ variables, sessionId }: UseQueryExecutionProps) {
    const [results, setResults] = useState<arrow.RecordBatch[]>([])
    const [totalRows, setTotalRows] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [executionTime, setExecutionTime] = useState<number>()
    const [queryStatus, setQueryStatus] = useState<"completed" | "cancelled" | null>(null)
    const [errorDetail, setErrorDetail] = useState<string | null>(null)
    const [executedQuery, setExecutedQuery] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const processQuery = useCallback((sqlQuery: string) => {
        return processJinjaTemplate(sqlQuery, variables)
    }, [variables])

    const handleRunQuery = useCallback(async (queryToRun: string, connectionId?: string | number) => {
        if (isLoading) return

        const { missingVariables } = processQuery(queryToRun)
        const missingRequired = missingVariables.filter((v: any) => v.required)
        if (missingRequired.length > 0) {
            const missingLabels = missingRequired.map((v: any) => v.label).join(", ")
            toast.error(`Zorunlu kriterlerde değer eksik: ${missingLabels}`)
            return { missingRequired: true }
        }

        setIsLoading(true)
        setResults([])
        setTotalRows(0)
        setExecutionTime(undefined)
        setQueryStatus(null)
        setErrorDetail(null)
        setExecutedQuery(queryToRun) // Store the query being executed

        const criteria: Record<string, any> = {};
        variables.forEach(v => {
            const val = v.value || v.defaultValue;
            if (val) criteria[v.name] = val;
        });

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const startTime = Date.now()
            console.log("Sending query:", queryToRun, "Connection:", connectionId)

            const response = await fetch("/api/flight/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId
                },
                body: JSON.stringify({ query: queryToRun, criteria, connectionId }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            if (!response.body) throw new Error("No response body");

            const reader = await arrow.RecordBatchReader.from(response.body);

            let tempBatches: arrow.RecordBatch[] = [];
            let tempCount = 0;
            let lastUpdate = Date.now();

            const flush = () => {
                if (tempBatches.length > 0) {
                    const newCount = tempCount;
                    const newBatches = [...tempBatches];
                    tempBatches = [];
                    tempCount = 0;

                    setResults(prev => [...prev, ...newBatches]);
                    setTotalRows(prev => prev + newCount);
                    lastUpdate = Date.now();
                }
            };

            let isFirstBatch = true;
            for await (const batch of reader) {
                console.log(`[Streaming] Paket alındı: ${batch.numRows} satır`);
                tempBatches.push(batch);
                tempCount += batch.numRows;

                const now = Date.now();
                // Update UI every 32ms (roughly 30fps) for smoothness, or immediately for the first batch
                if (isFirstBatch || now - lastUpdate > 32) {
                    flush();
                    isFirstBatch = false;
                }
            }
            flush();

            setExecutionTime(Date.now() - startTime);
            setQueryStatus("completed");

        } catch (e: any) {
            // If we manually aborted, we might get various errors (AbortError, or stream unexpected end)
            // We should treat all of them as "Cancelled" if the signal is aborted.
            if (e.name === 'AbortError' || controller.signal.aborted) {
                toast.info("Sorgu iptal edildi")
                setQueryStatus("cancelled")
            } else {
                // If not aborted, it's a real error
                console.error("Query execution error:", e);

                // Specific filter for the "Expected to read..." error which sometimes happens 
                // if the server closes connection abruptly but frontend didn't register abort yet
                if (e.message && e.message.includes("Expected to read") && e.message.includes("but only read 0")) {
                    // Treat as cancellation or network interruption
                    toast.warning("Sorgu akışı kesildi.")
                    setQueryStatus("cancelled")
                } else {
                    setErrorDetail(e.message)
                }
            }
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
        return { success: true }
    }, [isLoading, variables, processQuery, sessionId])

    const handleCancelQuery = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            setIsLoading(false)
        }
    }, [])

    return {
        results,
        totalRows,
        setResults,
        isLoading,
        executionTime,
        queryStatus,
        errorDetail,
        executedQuery,
        handleRunQuery,
        handleCancelQuery,
        processQuery,
        setErrorDetail
    }
}
