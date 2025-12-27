import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { processJinjaTemplate } from "../lib/utils"
import type { Variable } from "../lib/types"

interface UseQueryExecutionProps {
    variables: Variable[]
}

export function useQueryExecution({ variables }: UseQueryExecutionProps) {
    const [results, setResults] = useState<Record<string, unknown>[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [executionTime, setExecutionTime] = useState<number>()
    const [queryStatus, setQueryStatus] = useState<"completed" | "cancelled" | null>(null)
    const [errorDetail, setErrorDetail] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const processQuery = useCallback((sqlQuery: string) => {
        return processJinjaTemplate(sqlQuery, variables)
    }, [variables])

    const handleRunQuery = useCallback(async (queryToRun: string) => {
        if (isLoading) return

        // Check for missing required variables
        const { missingVariables } = processQuery(queryToRun)
        const missingRequired = missingVariables.filter(v => v.required)
        if (missingRequired.length > 0) {
            const missingLabels = missingRequired.map(v => v.label).join(", ")
            toast.error(`Zorunlu kriterlerde değer eksik: ${missingLabels}`, {
                description: "Lütfen Kriterler panelinden bu alanlara değer girin."
            })
            // Return specific requirement error so parent can open panel if needed
            return { missingRequired: true }
        }

        setIsLoading(true)
        setResults([])
        setExecutionTime(undefined)
        setQueryStatus(null)
        setErrorDetail(null)

        // Prepare criteria
        const criteria: Record<string, any> = {};
        variables.forEach(v => {
            const val = v.value || v.defaultValue;
            if (val) criteria[v.name] = val;
        });

        const payload = { query: queryToRun, criteria };

        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        const controller = new AbortController()
        abortControllerRef.current = controller

        console.log(">>> [Hook] Running Query via Flight:", payload);

        try {
            const startTime = Date.now()
            const response = await fetch("/api/flight/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            let pendingRows: Record<string, unknown>[] = [];
            let lastUpdate = Date.now();

            const flushBuffer = () => {
                if (pendingRows.length > 0) {
                    const batch = pendingRows;
                    pendingRows = [];
                    setResults(prev => [...prev, ...batch]);
                    lastUpdate = Date.now();
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        if (msg.type === "metadata") {
                            if (!msg.success) throw new Error(msg.error);
                        } else if (msg.type === "batch") {
                            if (msg.data && Array.isArray(msg.data)) {
                                pendingRows.push(...msg.data);
                            }
                        } else if (msg.type === "error") {
                            throw new Error(msg.error);
                        }
                    } catch (e) {
                        // Flush before throwing to show partial results? 
                        // No, if error triggers, likely stream is dead or invalid.
                        throw e;
                    }
                }

                // Flush if enough time passed or buffer is large
                // Strategy: As the dataset grows, we want to batch MORE to avoid O(N) array copies.
                // 400k rows: 
                // Copying 300k items takes ~1-2ms. Doing it 60fps is bad. Doing it 2fps is fine.
                // Thresholds:
                // - Time: 500ms (2 FPS updates) - keeps UI responsive enough but reduces main thread load
                // - Count: 10,000 - Ensures we process decent chunks
                // - Max delay: If we have ANY data, don't wait forever, but rely on time.

                const now = Date.now();
                const timeDiff = now - lastUpdate;

                // Dynamic buffering: If getting slammed with data, increase buffer size
                const bufferThreshold = results.length > 100000 ? 25000 : 5000;

                if ((timeDiff > 500 && pendingRows.length > 0) || pendingRows.length > bufferThreshold) {
                    flushBuffer();
                }
            }
            // Final flush
            flushBuffer();

            const duration = Date.now() - startTime;
            setExecutionTime(duration);
            setQueryStatus("completed");

        } catch (e: any) {
            if (e.name === 'AbortError') {
                // Query cancelled - keep existing results
                toast.info("Sorgu iptal edildi - mevcut veriler korundu")
                setQueryStatus("cancelled")
                // Don't clear results - user can see partial data
            } else {
                const fullError = e instanceof Error ? e.message : "Bilinmeyen bir hata oluştu";
                let shortError = fullError;
                const splitIndex = fullError.indexOf(". Detail:");
                if (splitIndex !== -1) {
                    shortError = fullError.substring(0, splitIndex);
                }

                toast.error(shortError, {
                    description: "Hata detaylarını görüntülemek için tıklayın.",
                    action: {
                        label: "Detaylar",
                        onClick: () => setErrorDetail(fullError)
                    }
                })
                setQueryStatus(null)
            }
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
        return { success: true }
    }, [isLoading, variables, processQuery])

    const handleCancelQuery = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            setIsLoading(false)
        }
    }, [])

    return {
        results,
        setResults, // Allow clearing externally if needed
        isLoading,
        executionTime,
        queryStatus,
        errorDetail,
        handleRunQuery,
        handleCancelQuery,
        processQuery,
        setErrorDetail
    }
}
