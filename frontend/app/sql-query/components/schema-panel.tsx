"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Database,
  Table2,
  Layers,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  RefreshCcw,
  ScanEye,
  Trash2,
} from "lucide-react"

import type { Schema } from "../lib/types"
import { getColumnIcon } from "../lib/utils"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { useEffect } from "react"

function DurationTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // Immediate update
    setElapsed(Date.now() - startTime)

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 100)
    return () => clearInterval(interval)
  }, [startTime])

  return <span>{(elapsed / 1000).toFixed(1)}s</span>
}

interface SchemaPanelProps {
  schema: Schema
  onTableClick: (tableName: string) => void
  onRefreshTable?: (tableName: string) => void
  onDropTable?: (tableName: string, tableType?: string) => void
  refreshingTables?: Set<string>
  tableStats?: Record<string, { lastRefreshedAt: number, durationMs: number }>
  onClose: () => void
}

export function SchemaPanel({
  schema,
  onTableClick,
  onRefreshTable,
  onDropTable,
  refreshingTables = new Set(),
  tableStats = {},
  onClose
}: SchemaPanelProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(["ACCOUNTS"]))
  const [modelsExpanded, setModelsExpanded] = useState(true)
  const [baseTablesExpanded, setBaseTablesExpanded] = useState(true)
  const [viewsExpanded, setViewsExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshStartTimes, setRefreshStartTimes] = useState<Record<string, number>>({})

  // Sync start times when refreshingTables changes
  useEffect(() => {
    setRefreshStartTimes(prev => {
      const next = { ...prev }
      // Remove finished
      Object.keys(next).forEach(key => {
        if (!refreshingTables.has(key)) {
          delete next[key]
        }
      })
      // Add new
      refreshingTables.forEach(key => {
        if (!next[key]) {
          next[key] = Date.now()
        }
      })
      return next
    })
  }, [refreshingTables])

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  // Arama filtresi
  const filteredAll = schema.tables.filter(table => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    if (table.name.toLowerCase().includes(query)) return true
    return table.columns.some(col => col.name.toLowerCase().includes(query))
  })

  const baseTables = filteredAll.filter(t => !t.type || t.type === 'BASE TABLE')
  const views = filteredAll.filter(t => t.type === 'VIEW')

  const renderTableItem = (table: Schema['tables'][0]) => {
    const isExpanded = expandedTables.has(table.name)
    const isView = table.type === 'VIEW'
    const Icon = Table2
    const iconColor = isView ? "text-emerald-500" : "text-blue-500"
    const bgColor = isView ? "bg-emerald-500/10" : "bg-blue-500/10"

    return (
      <div key={table.name} className="group/table">
        <div
          onClick={() => toggleTable(table.name)}
          onDoubleClick={() => onTableClick(table.name)}
          className={`
            flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer w-full transition-colors group/table-row
            ${isExpanded ? 'bg-muted' : 'hover:bg-muted/50'}
          `}
        >
          <div className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${isExpanded ? 'bg-background' : ''}`}>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${bgColor}`}>
            <Icon className={`h-3 w-3 ${iconColor}`} />
          </div>
          <span className="text-sm font-medium text-foreground flex-1 text-left">{table.name}</span>
          <div className="flex items-center gap-1">
            {onRefreshTable && (
              <div className="relative group/refresh flex items-center justify-end min-w-[60px]">
                {/* Default View: Time Ago (Hidden on hover) */}
                <span className={`text-[10px] text-muted-foreground transition-opacity text-right
                  ${refreshingTables.has(table.name) ? 'opacity-0' : 'group-hover/table-row:opacity-0 opacity-100'}
                `}>
                  {tableStats[table.name]
                    ? formatDistanceToNow(tableStats[table.name].lastRefreshedAt, { addSuffix: true, locale: tr })
                    : ''}
                </span>

                {/* Hover/Refreshing View: Button + Duration */}
                <div className={`absolute right-0 flex items-center gap-1 transition-opacity
                  ${refreshingTables.has(table.name) ? 'opacity-100' : 'opacity-0 group-hover/table-row:opacity-100'}
                `}>
                  {/* Duration Label */}
                  {refreshingTables.has(table.name) ? (
                    <span className="text-[10px] text-primary font-medium whitespace-nowrap">
                      <DurationTimer startTime={refreshStartTimes[table.name] || Date.now()} />
                    </span>
                  ) : (
                    tableStats[table.name] && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {(tableStats[table.name].durationMs / 1000).toFixed(1)}s
                      </span>
                    )
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshTable(table.name);
                    }}
                    disabled={refreshingTables.has(table.name)}
                  >
                    <RefreshCcw className={`h-3 w-3 ${refreshingTables.has(table.name) ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </div>
            )}
            {onDropTable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover/table-row:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDropTable(table.name, table.type);
                }}
                disabled={refreshingTables.has(table.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="ml-7 mt-1 mb-2 border-l-2 border-muted pl-3 space-y-0.5">
            {table.columns.map((col) => {
              const { icon: ColIcon, color } = getColumnIcon(col.type, !!col.fk)
              const isHighlighted = searchQuery && col.name.toLowerCase().includes(searchQuery.toLowerCase())
              return (
                <div
                  key={col.name}
                  onClick={() => onTableClick(`${table.name}.${col.name}`)}
                  className={`
                    flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group/col transition-colors
                    ${isHighlighted ? 'bg-amber-500/10' : 'hover:bg-muted/50'}
                  `}
                >
                  <ColIcon className={`h-3 w-3 shrink-0 ${color}`} />
                  <span className="text-xs text-foreground/80 flex-1">{col.name}</span>
                  <div className="flex items-center gap-1.5">
                    {col.fk && (
                      <span className="text-[9px] text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded font-medium">
                        FK → {col.fk}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {col.type}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[53px] border-b bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">{schema.name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tablo veya kolon ara..."
            className="h-8 pl-8 text-xs bg-muted/30 border-transparent focus:border-border"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Models */}
        <div>
          <button
            onClick={() => setModelsExpanded(!modelsExpanded)}
            className="flex items-center gap-2 w-full group"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${modelsExpanded ? 'bg-muted' : 'group-hover:bg-muted/50'}`}>
              {modelsExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/10">
              <Layers className="h-3 w-3 text-purple-500" />
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Modeller
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
              {schema.models.length}
            </span>
          </button>
          {modelsExpanded && (
            <div className="mt-2 ml-5 space-y-1">
              {schema.models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                    <Layers className="h-3 w-3 text-purple-500" />
                  </div>
                  <span className="text-sm text-foreground flex-1">{model.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">#{model.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tables */}
        <div>
          <button
            onClick={() => setBaseTablesExpanded(!baseTablesExpanded)}
            className="flex items-center gap-2 w-full group"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${baseTablesExpanded ? 'bg-muted' : 'group-hover:bg-muted/50'}`}>
              {baseTablesExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10">
              <Table2 className="h-3 w-3 text-blue-500" />
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Tablolar
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
              {baseTables.length}
            </span>
          </button>
          {baseTablesExpanded && (
            <div className="mt-2 ml-5 space-y-1">
              {baseTables.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="text-xs text-muted-foreground">Tablo bulunamadı</p>
                </div>
              ) : (
                baseTables.map((table) => renderTableItem(table))
              )}
            </div>
          )}
        </div>

        {/* Views */}
        <div>
          <button
            onClick={() => setViewsExpanded(!viewsExpanded)}
            className="flex items-center gap-2 w-full group"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${viewsExpanded ? 'bg-muted' : 'group-hover:bg-muted/50'}`}>
              {viewsExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10">
              <Table2 className="h-3 w-3 text-emerald-500" />
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Görünümler
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
              {views.length}
            </span>
          </button>
          {viewsExpanded && (
            <div className="mt-2 ml-5 space-y-1">
              {views.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="text-xs text-muted-foreground">Görünüm bulunamadı</p>
                </div>
              ) : (
                views.map((table) => renderTableItem(table))
              )}
            </div>
          )}
        </div>
      </div >

      {/* Footer - Quick tips */}
      < div className="px-4 py-3 border-t bg-muted/10" >
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">İpucu:</span> Tabloya çift tıklayarak sorguya ekleyin
        </p>
      </div >
    </div >
  )
}

