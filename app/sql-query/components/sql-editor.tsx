"use client"

import { useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Play, Square, GripHorizontal } from "lucide-react"

// Ace Editor'ı dinamik olarak yükle (SSR desteği yok)
const AceEditor = dynamic(
  async () => {
    const ace = await import("react-ace")
    const aceBuilds = await import("ace-builds")
    await import("ace-builds/src-noconflict/mode-sql")
    await import("ace-builds/src-noconflict/theme-tomorrow_night")
    await import("ace-builds/src-noconflict/theme-tomorrow")
    await import("ace-builds/src-noconflict/ext-language_tools")
    
    // SQL anahtar kelimeleri
    const sqlKeywords = [
      "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
      "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN",
      "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AS", "DISTINCT", "COUNT",
      "SUM", "AVG", "MIN", "MAX", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
      "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "INDEX", "PRIMARY KEY",
      "FOREIGN KEY", "REFERENCES", "NULL", "NOT NULL", "DEFAULT", "UNIQUE",
      "CHECK", "CONSTRAINT", "CASCADE", "UNION", "INTERSECT", "EXCEPT", "ALL",
      "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "COALESCE",
      "NULLIF", "TRUE", "FALSE", "ASC", "DESC", "IS", "IS NOT"
    ]
    
    // Tablo isimleri
    const tableNames = [
      "ACCOUNTS", "ANALYTIC_EVENTS", "FEEDBACK", "INVOICES", 
      "ORDERS", "PEOPLE", "PRODUCTS", "REVIEWS"
    ]
    
    // Kolon isimleri
    const columnNames = [
      "ID", "EMAIL", "FIRST_NAME", "LAST_NAME", "PLAN", "SOURCE", "SEATS",
      "CREATED_AT", "TRIAL_ENDS_AT", "CANCELED_AT", "ACTIVE_SUBSCRIPTION",
      "ACCOUNT_ID", "EVENT_TYPE", "EVENT_DATA", "RATING", "COMMENT",
      "AMOUNT", "STATUS", "DUE_DATE", "PAID_AT", "USER_ID", "PRODUCT_ID",
      "QUANTITY", "TOTAL", "NAME", "CITY", "CATEGORY", "PRICE", "VENDOR"
    ]
    
    // Custom completer ekle
    const customCompleter = {
      getCompletions: (
        _editor: unknown,
        _session: unknown,
        _pos: unknown,
        _prefix: string,
        callback: (error: null, completions: Array<{caption: string, value: string, meta: string, score: number}>) => void
      ) => {
        const completions = [
          ...sqlKeywords.map(kw => ({
            caption: kw,
            value: kw,
            meta: "keyword",
            score: 1000
          })),
          ...tableNames.map(t => ({
            caption: t,
            value: t,
            meta: "table",
            score: 900
          })),
          ...columnNames.map(c => ({
            caption: c,
            value: c,
            meta: "column",
            score: 800
          }))
        ]
        callback(null, completions)
      }
    }
    
    // Completer'ı ekle
    const langTools = aceBuilds.require("ace/ext/language_tools")
    langTools.addCompleter(customCompleter)
    
    return ace
  },
  { ssr: false }
)

interface SQLEditorProps {
  query: string
  onQueryChange: (query: string) => void
  onRunQuery: () => void
  onCancelQuery: () => void
  isLoading: boolean
  isDarkMode: boolean
  editorHeight: number
  isResizing: boolean
  onResizeStart: (e: React.MouseEvent) => void
}

export function SQLEditor({
  query,
  onQueryChange,
  onRunQuery,
  onCancelQuery,
  isLoading,
  isDarkMode,
  editorHeight,
  isResizing,
  onResizeStart,
}: SQLEditorProps) {
  const editorRef = useRef<unknown>(null)

  return (
    <>
      {/* SQL Editor */}
      <div className="relative" style={{ height: editorHeight }}>
        <AceEditor
          ref={editorRef as React.LegacyRef<unknown>}
          mode="sql"
          theme={isDarkMode ? "tomorrow_night" : "tomorrow"}
          onChange={onQueryChange}
          value={query}
          name="sql-editor"
          width="100%"
          height="100%"
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
          style={{
            background: "transparent",
          }}
        />

        {/* Run / Cancel Button */}
        <div className="absolute right-4 bottom-4">
          <Button
            onClick={isLoading ? onCancelQuery : onRunQuery}
            size="icon"
            className={`h-10 w-10 rounded-full text-white ${
              isLoading 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        className={`
          h-2 border-y bg-muted/30 cursor-row-resize flex items-center justify-center
          hover:bg-muted/50 transition-colors
          ${isResizing ? 'bg-muted/50' : ''}
        `}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground/50" />
      </div>
    </>
  )
}

