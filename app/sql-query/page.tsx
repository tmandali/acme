"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import yaml from "js-yaml"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Database,
  Save,
  Settings2,
  FolderOpen,
  GripVertical,
} from "lucide-react"

// Bileşenler
import { SchemaPanel } from "./components/schema-panel"
import { VariablesPanel } from "./components/variables-panel"
import { ResultsTable } from "./components/results-table"
import { SQLEditor } from "./components/sql-editor"

// Tipler ve Veriler
import type { Variable, QueryFile } from "./lib/types"
import { sampleSchema, sampleResults } from "./lib/data"
import { parseDefaultValues } from "./lib/utils"

export default function SQLQueryPage() {
  const [query, setQuery] = useState("select * from ACCOUNTS")
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [executionTime, setExecutionTime] = useState<number>()
  const [queryStatus, setQueryStatus] = useState<"completed" | "cancelled" | null>(null)
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(true)
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(false)
  const [variables, setVariables] = useState<Variable[]>([])
  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [editorHeight, setEditorHeight] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
  const [queryName, setQueryName] = useState("Yeni sorgu")
  const [isResultsFullscreen, setIsResultsFullscreen] = useState(false)
  const [sidePanelWidth, setSidePanelWidth] = useState(320) // Shared width for both panels
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // YAML dosyasına kaydet
  const handleSaveToYaml = useCallback(() => {
    const queryFile: QueryFile = {
      name: queryName,
      sql: query,
      variables: variables,
    }

    const yamlContent = yaml.dump(queryFile, {
      indent: 2,
      lineWidth: -1, // Satır kırma yapma
      quotingType: '"',
      forceQuotes: false,
    })

    // Dosya adı için güvenli isim oluştur
    const safeFileName = queryName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'sorgu'

    // Dosyayı indir
    const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeFileName}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [queryName, query, variables])

  // YAML dosyasından yükle
  const handleLoadFromYaml = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = yaml.load(content) as QueryFile

        if (parsed) {
          // Sorgu adını güncelle
          if (parsed.name) {
            setQueryName(parsed.name)
          }

          // SQL sorgusunu güncelle
          if (parsed.sql) {
            setQuery(parsed.sql)
          }

          // Değişkenleri güncelle
          if (parsed.variables && Array.isArray(parsed.variables)) {
            setVariables(parsed.variables)
            setSelectedVariable(null)
          }

          // Sonuçları temizle
          setResults([])
          setExecutionTime(undefined)
        }
      } catch (error) {
        console.error("YAML dosyası yüklenirken hata oluştu:", error)
        alert("YAML dosyası yüklenirken hata oluştu. Lütfen geçerli bir dosya seçin.")
      }
    }
    reader.readAsText(file)

    // Input'u sıfırla (aynı dosyayı tekrar seçebilmek için)
    event.target.value = ''
  }, [])

  // Dosya aç butonuna tıklama
  const handleOpenFileClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    })
    
    return () => observer.disconnect()
  }, [])

  // SQL'deki {{VARIABLE}} pattern'lerinden otomatik kriter oluştur (debounced)
  useEffect(() => {
    // Kullanıcı yazmayı bitirene kadar bekle (500ms)
    const timeoutId = setTimeout(() => {
      const templatePattern = /\{\{(\w+)\}\}/g
      const foundVariables: string[] = []
      let match
      
      while ((match = templatePattern.exec(query)) !== null) {
        const varName = match[1]
        if (!foundVariables.includes(varName)) {
          foundVariables.push(varName)
        }
      }
      
      // Eksik değişkenleri ekle
      setVariables(prev => {
        const existingNames = prev.map(v => v.name)
        const newVariables: Variable[] = []
        
        for (const varName of foundVariables) {
          if (!existingNames.includes(varName)) {
            newVariables.push({
              id: `var_${Date.now()}_${varName}`,
              name: varName,
              type: "text",
              label: varName,
              filterType: "input",
              multiSelect: false,
              defaultValue: "",
              value: "",
              required: false,
              valuesSource: "custom",
              customValues: "",
            })
          }
        }
        
        if (newVariables.length > 0) {
          return [...prev, ...newVariables]
        }
        return prev
      })
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [query])

  // Jinja template işleme fonksiyonu
  const processJinjaTemplate = useCallback((sqlQuery: string): { processedQuery: string; replacements: Record<string, string>; missingVariables: { name: string; label: string; required: boolean }[] } => {
    const replacements: Record<string, string> = {}
    const missingVariables: { name: string; label: string; required: boolean }[] = []
    
    // {{VARIABLE_NAME}} pattern'ini bul ve değiştir
    const templatePattern = /\{\{(\w+)\}\}/g
    
    const processedQuery = sqlQuery.replace(templatePattern, (match, varName) => {
      // Variable'lardan değeri bul - sadece name ile eşleştir
      const variable = variables.find(v => v.name === varName)
      
      // Aktif değeri al (value boşsa defaultValue'yu kullan)
      const activeValue = variable?.value || variable?.defaultValue
      
      if (variable && activeValue) {
        let replacement: string
        
        // Switch filtre yöntemi için değeri olduğu gibi kullan (tırnaksız)
        if (variable.filterType === "switch") {
          replacement = activeValue
          replacements[varName] = replacement
          return replacement
        }
        
        // Çoklu değer için array olabilir
        const values = parseDefaultValues(activeValue)
        
        if (values.length > 1) {
          // Çoklu değer: IN clause için format
          if (variable.type === "number") {
            replacement = `(${values.join(", ")})`
          } else {
            replacement = `('${values.join("', '")}')`
          }
        } else if (values.length === 1) {
          // Tek değer
          if (variable.type === "number") {
            replacement = values[0]
          } else {
            replacement = `'${values[0]}'`
          }
        } else {
          // Değer boş - eksik değişken olarak işaretle
          missingVariables.push({ name: varName, label: variable.label, required: variable.required })
          return "" // Boş değer için boş string kullan
        }
        
        replacements[varName] = replacement
        return replacement
      }
      
      // Variable tanımlı ama değeri yok
      if (variable) {
        missingVariables.push({ name: varName, label: variable.label, required: variable.required })
        return "" // Değer yoksa boş string kullan
      }
      
      // Variable hiç tanımlı değil - boş string kullan
      missingVariables.push({ name: varName, label: varName, required: false })
      return ""
    })
    
    return { processedQuery, replacements, missingVariables }
  }, [variables])

  const handleRunQuery = useCallback(() => {
    // Jinja template işleme
    const { processedQuery, replacements, missingVariables } = processJinjaTemplate(query)
    
    // Query'deki tüm template değişkenlerini bul
    const templatePattern = /\{\{(\w+)\}\}/g
    const allTemplateVars: string[] = []
    let match
    while ((match = templatePattern.exec(query)) !== null) {
      if (!allTemplateVars.includes(match[1])) {
        allTemplateVars.push(match[1])
      }
    }
    
    // Zorunlu kriterlerde eksik değer kontrolü
    const missingRequired = missingVariables.filter(v => v.required)
    if (missingRequired.length > 0) {
      const missingLabels = missingRequired.map(v => v.label).join(", ")
      alert(`Zorunlu kriterlerde değer eksik: ${missingLabels}\n\nLütfen Kriterler panelinden bu alanlara değer girin.`)
      // Kriterler panelini aç
      setVariablesPanelOpen(true)
      setSchemaPanelOpen(false)
      return
    }
    
    setIsLoading(true)
    setResults([])
    setQueryStatus(null)
    
    // Konsola detaylı bilgi yazdır
    console.log("╔══════════════════════════════════════════════════════════════")
    console.log("║ 🔍 SQL Sorgusu Çalıştırılıyor")
    console.log("╠══════════════════════════════════════════════════════════════")
    console.log("║ 📋 Tanımlı Değişkenler:")
    variables.forEach((v, i) => {
      const activeVal = v.value || v.defaultValue
      console.log(`║   ${i + 1}. name: "${v.name}", label: "${v.label}", type: "${v.type}", value: "${activeVal}"`)
    })
    console.log("╠══════════════════════════════════════════════════════════════")
    console.log("║ 📝 Orijinal Sorgu:")
    console.log("║", query.split('\n').join('\n║ '))
    
    if (allTemplateVars.length > 0) {
      console.log("╠══════════════════════════════════════════════════════════════")
      console.log("║ 🔄 Template Değişkenleri:")
      allTemplateVars.forEach((varName) => {
        const isMissing = missingVariables.some(v => v.name === varName)
        if (replacements[varName]) {
          console.log(`║   ✅ {{${varName}}} → ${replacements[varName]}`)
        } else if (isMissing) {
          console.log(`║   ⚠️ {{${varName}}} → (boş - değer atanmamış)`)
        }
      })
    }
    
    console.log("╠══════════════════════════════════════════════════════════════")
    console.log("║ ✅ İşlenmiş (Final) Sorgu:")
    console.log("║", processedQuery.split('\n').join('\n║ '))
    console.log("╚══════════════════════════════════════════════════════════════")
    
    // Simüle edilmiş sorgu çalıştırma (1 saniye)
    queryTimeoutRef.current = setTimeout(() => {
      setResults(sampleResults)
      setExecutionTime(Math.floor(Math.random() * 100) + 20)
      setIsLoading(false)
      setQueryStatus("completed")
      queryTimeoutRef.current = null
    }, 1000)
  }, [query, processJinjaTemplate, variables])

  const handleCancelQuery = useCallback(() => {
    if (queryTimeoutRef.current) {
      clearTimeout(queryTimeoutRef.current)
      queryTimeoutRef.current = null
      setIsLoading(false)
      setQueryStatus("cancelled")
      console.log("╔══════════════════════════════════════════════════════════════")
      console.log("║ ❌ SORGU İPTAL EDİLDİ")
      console.log("╚══════════════════════════════════════════════════════════════")
    }
  }, [])

  const handleTableClick = useCallback((identifier: string) => {
    // Tablo veya kolon adını editöre ekle
    if (identifier.includes('.')) {
      setQuery((prev) => prev + ` ${identifier}`)
    } else {
      setQuery(`select * from ${identifier}`)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRunQuery()
      }
      // ESC ile tam ekrandan çık
      if (e.key === 'Escape' && isResultsFullscreen) {
        setIsResultsFullscreen(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRunQuery, isResultsFullscreen])

  // Resize handler for editor
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startY = e.clientY
    const startHeight = editorHeight

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY
      const newHeight = Math.max(100, Math.min(500, startHeight + delta))
      setEditorHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editorHeight])

  // Resize handler for side panel
  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingPanel(true)
    const startX = e.clientX
    const startWidth = sidePanelWidth

    const handleMouseMove = (e: MouseEvent) => {
      // Panel sağda olduğu için, sola sürüklemek genişliği artırır
      const delta = startX - e.clientX
      const newWidth = Math.max(320, Math.min(600, startWidth + delta))
      setSidePanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingPanel(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [sidePanelWidth])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <input
                    type="text"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1"
                    placeholder="Sorgu adı..."
                  />
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            {/* Gizli file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml"
              onChange={handleLoadFromYaml}
              className="hidden"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenFileClick}>
              <FolderOpen className="h-3.5 w-3.5" />
              Dosya Aç
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveToYaml}>
              <Save className="h-3.5 w-3.5" />
              Kaydet
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor & Results Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Database Selector & Editor - Tam ekranda gizle */}
            {!isResultsFullscreen && (
              <div className="flex flex-col" ref={containerRef}>
                {/* Database Selector */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                  <span className="text-xs text-muted-foreground">Sample Database</span>
                  <div className="flex items-center border rounded-md overflow-hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-xs gap-1 rounded-none border-r ${schemaPanelOpen ? 'bg-muted' : ''}`}
                      onClick={() => {
                        if (schemaPanelOpen) {
                          setSchemaPanelOpen(false)
                        } else {
                          setSchemaPanelOpen(true)
                          setVariablesPanelOpen(false)
                        }
                      }}
                    >
                      <Database className="h-3 w-3" />
                      Şema
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-xs gap-1 rounded-none ${variablesPanelOpen ? 'bg-muted' : ''}`}
                      onClick={() => {
                        if (variablesPanelOpen) {
                          setVariablesPanelOpen(false)
                        } else {
                          setVariablesPanelOpen(true)
                          setSchemaPanelOpen(false)
                        }
                      }}
                    >
                      <Settings2 className="h-3 w-3" />
                      Kriterler
                      {variables.length > 0 && (
                        <span className="ml-1 bg-primary/20 text-primary rounded px-1 text-[10px]">
                          {variables.length}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {/* SQL Editor */}
                <SQLEditor
                  query={query}
                  onQueryChange={setQuery}
                  onRunQuery={handleRunQuery}
                  onCancelQuery={handleCancelQuery}
                  isLoading={isLoading}
                  isDarkMode={isDarkMode}
                  editorHeight={editorHeight}
                  isResizing={isResizing}
                  onResizeStart={handleResizeStart}
                />
              </div>
            )}

            {/* Results */}
            <div className="flex-1 overflow-hidden">
              <ResultsTable 
                results={results} 
                isLoading={isLoading}
                executionTime={executionTime}
                queryStatus={queryStatus}
                isFullscreen={isResultsFullscreen}
                onToggleFullscreen={() => setIsResultsFullscreen(prev => !prev)}
              />
            </div>
          </div>

          {/* Schema Panel - Tam ekranda gizle */}
          {schemaPanelOpen && !isResultsFullscreen && (
            <div className="shrink-0 flex" style={{ width: sidePanelWidth }}>
              {/* Resize Handle */}
              <div
                onMouseDown={handlePanelResizeStart}
                className={`w-1 cursor-col-resize flex items-center justify-center hover:bg-primary/20 transition-colors ${isResizingPanel ? 'bg-primary/30' : ''}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <div className="flex-1 overflow-hidden">
                <SchemaPanel 
                  schema={sampleSchema}
                  onTableClick={handleTableClick}
                  onClose={() => setSchemaPanelOpen(false)}
                />
              </div>
            </div>
          )}

          {/* Variables Panel - Tam ekranda gizle */}
          {variablesPanelOpen && !isResultsFullscreen && (
            <div className="shrink-0 flex" style={{ width: sidePanelWidth }}>
              {/* Resize Handle */}
              <div
                onMouseDown={handlePanelResizeStart}
                className={`w-1 cursor-col-resize flex items-center justify-center hover:bg-primary/20 transition-colors ${isResizingPanel ? 'bg-primary/30' : ''}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <div className="flex-1 overflow-hidden">
                <VariablesPanel
                  variables={variables}
                  onVariablesChange={setVariables}
                  onClose={() => setVariablesPanelOpen(false)}
                  selectedVariable={selectedVariable}
                  onSelectVariable={setSelectedVariable}
                  query={query}
                />
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
