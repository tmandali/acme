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
} from "lucide-react"
import type { Schema } from "../lib/types"
import { getColumnIcon } from "../lib/utils"

interface SchemaPanelProps {
  schema: Schema
  onTableClick: (tableName: string) => void
  onClose: () => void
}

export function SchemaPanel({ 
  schema, 
  onTableClick,
  onClose 
}: SchemaPanelProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(["ACCOUNTS"]))
  const [modelsExpanded, setModelsExpanded] = useState(true)
  const [tablesExpanded, setTablesExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

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
  const filteredTables = schema.tables.filter(table => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    if (table.name.toLowerCase().includes(query)) return true
    return table.columns.some(col => col.name.toLowerCase().includes(query))
  })

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
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
            onClick={() => setTablesExpanded(!tablesExpanded)}
            className="flex items-center gap-2 w-full group"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${tablesExpanded ? 'bg-muted' : 'group-hover:bg-muted/50'}`}>
              {tablesExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10">
              <Table2 className="h-3 w-3 text-blue-500" />
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Tablolar
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
              {filteredTables.length}
            </span>
          </button>
          {tablesExpanded && (
            <div className="mt-2 ml-5 space-y-1">
              {filteredTables.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">Sonuç bulunamadı</p>
                </div>
              ) : (
                filteredTables.map((table) => {
                  const isExpanded = expandedTables.has(table.name)
                  return (
                    <div key={table.name} className="group/table">
                      <button
                        onClick={() => toggleTable(table.name)}
                        onDoubleClick={() => onTableClick(table.name)}
                        className={`
                          flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer w-full transition-colors
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
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                          <Table2 className="h-3 w-3 text-blue-500" />
                        </div>
                        <span className="text-sm font-medium text-foreground flex-1 text-left">{table.name}</span>
                        <span className="text-[10px] text-muted-foreground opacity-0 group-hover/table:opacity-100 transition-opacity">
                          {table.columns.length} kolon
                        </span>
                      </button>
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
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Quick tips */}
      <div className="px-4 py-3 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">İpucu:</span> Tabloya çift tıklayarak sorguya ekleyin
        </p>
      </div>
    </div>
  )
}

