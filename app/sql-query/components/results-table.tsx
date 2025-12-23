"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Database,
  RefreshCw,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  XCircle,
} from "lucide-react"

interface ResultsTableProps {
  results: Record<string, unknown>[]
  isLoading: boolean
  executionTime?: number
  queryStatus?: "completed" | "cancelled" | null
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function ResultsTable({
  results,
  isLoading,
  executionTime,
  queryStatus,
  isFullscreen = false,
  onToggleFullscreen
}: ResultsTableProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
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

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const milliseconds = Math.floor((ms % 1000) / 100)
    return `${seconds}.${milliseconds}s`
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Results Header */}
        <div className="flex items-center h-8 px-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!results.length && queryStatus !== "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Database className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Sorgu sonuçları burada görünecek</p>
        <p className="text-xs mt-1">Sorguyu çalıştırmak için yeşil butona tıklayın</p>
      </div>
    )
  }

  // İptal edildiğinde özel görünüm
  if (!results.length && queryStatus === "cancelled") {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Results Header */}
        <div className="flex items-center h-8 px-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              0 satır
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <XCircle className="h-8 w-8 mb-2 opacity-50 text-red-500" />
          <p className="text-sm">Sorgu iptal edildi</p>
          <p className="text-xs mt-1">Yeni bir sorgu çalıştırabilirsiniz</p>
        </div>
      </div>
    )
  }

  const columns = Object.keys(results[0])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Results Header */}
      <div className="flex items-center justify-between h-8 px-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {results.length} satır
          </span>
          {executionTime && (
            <span className="text-[10px] text-muted-foreground">
              • {executionTime}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b">
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5 whitespace-nowrap border-r bg-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => (
              <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/30">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-2 py-1 whitespace-nowrap border-r"
                  >
                    {row[col] === "" ? (
                      <span className="text-muted-foreground/50 italic text-[10px]">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

