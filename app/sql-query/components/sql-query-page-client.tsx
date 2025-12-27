"use client"
// Force rebuild

import { useState, useCallback, useRef, useEffect } from "react"
import yaml from "js-yaml"
import { toast } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import {
    Database,
    Download,
    Upload,
    Settings2,
    Copy,
    Check,
    Save,
    ChevronsUpDown,
    FileText,
} from "lucide-react"

// Bileşenler
import { SchemaPanel } from "./schema-panel"
import { VariablesPanel } from "./variables-panel"
import { ResultsTable } from "./results-table"
import { SQLEditor } from "./sql-editor"

// Tipler ve Veriler
import type { Variable, QueryFile, TemplateMetadata } from "../lib/types"
import { sampleSchema, sampleResults, sampleConnections } from "../lib/data"
import { processJinjaTemplate } from "../lib/utils"

interface SQLQueryPageClientProps {
    initialData?: QueryFile
    slug?: string
}

export default function SQLQueryPageClient({ initialData, slug }: SQLQueryPageClientProps) {
    const [query, setQuery] = useState(initialData?.sql || "select * from ACCOUNTS")
    const [results, setResults] = useState<Record<string, unknown>[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [executionTime, setExecutionTime] = useState<number>()
    const [queryStatus, setQueryStatus] = useState<"completed" | "cancelled" | null>(null)
    const [schemaPanelOpen, setSchemaPanelOpen] = useState(false)
    const [variablesPanelOpen, setVariablesPanelOpen] = useState(false)
    const [variables, setVariables] = useState<Variable[]>(initialData?.variables || [])
    const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [editorHeight, setEditorHeight] = useState(200)
    const [isResizing, setIsResizing] = useState(false)
    const [queryName, setQueryName] = useState(initialData?.name || "Yeni sorgu")
    const [isResultsFullscreen, setIsResultsFullscreen] = useState(false)
    const [sidePanelWidth, setSidePanelWidth] = useState(320) // Shared width for both panels
    const [isResizingPanel, setIsResizingPanel] = useState(false)
    const [activeTab, setActiveTab] = useState<"edit" | "preview" | "api">("edit")
    const [mounted, setMounted] = useState(false)
    const [selectedConnectionId, setSelectedConnectionId] = useState(initialData?.connectionId || sampleConnections[0].id)
    const [isConnOpen, setIsConnOpen] = useState(false)
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)
    const [templates, setTemplates] = useState<TemplateMetadata[]>([])
    const [activeTemplate, setActiveTemplate] = useState<TemplateMetadata | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const queryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const queryStatusRef = useRef<"completed" | "cancelled" | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Basit Kopyalama Butonu Bileşeni
    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false)

        const handleCopy = () => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }

        return (
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
            >
                {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                )}
            </Button>
        )
    }

    // YAML dosyasına kaydet
    const handleSaveToYaml = useCallback(() => {
        const cleanVariables = variables.map((v) => ({
            ...v,
            value: "", // Kullanıcı değerlerini kaydetme
        }))

        const queryFile: QueryFile = {
            name: queryName,
            sql: query,
            variables: cleanVariables,
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

    // Sunucuya kaydet
    const handleSaveToServer = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/sql-query/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: queryName,
                    sql: query,
                    variables: variables,
                    slug: slug, // Eğer varsa güncelleme yapacak
                    connectionId: selectedConnectionId,
                }),
            })

            const data = await response.json()

            if (data.success) {
                // Eğer yeni bir sorguysa ve slug değiştiyse URL'i güncelle
                if (!slug && data.slug) {
                    window.history.pushState({}, "", `/sql-query/${data.slug}`)
                }
                toast.success("Sorgu başarıyla kaydedildi.")
            } else {
                toast.error(`Hata: ${data.error || "Bilinmeyen bir hata oluştu"}`)
            }
        } catch (error) {
            console.error("Sorgu kaydedilirken hata oluştu:", error)
            toast.error("Sorgu kaydedilirken bir hata oluştu.")
        } finally {
            setIsLoading(false)
        }
    }, [queryName, query, variables, slug])

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
                toast.error("YAML dosyası yüklenirken hata oluştu. Lütfen geçerli bir dosya seçin.")
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

    useEffect(() => {
        setMounted(true)

        // Fetch Flight Templates
        fetch("/api/flight/list")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setTemplates(data)
                }
            })
            .catch(err => console.error("Failed to fetch templates:", err))
    }, [])

    const handleTemplateSelect = useCallback((template: TemplateMetadata) => {
        setActiveTemplate(template)
        setQueryName(template.description || template.name)
        setQuery(template.sql)

        // Convert params to variables
        const newVars: Variable[] = template.params.map(p => ({
            id: `var_tmpl_${p.name}`,
            name: p.name,
            label: p.label || p.name,
            type: p.type as any || "text",
            filterType: "input",
            multiSelect: false,
            defaultValue: p.default || "",
            value: "",
            required: p.required,
            valuesSource: "custom",
            customValues: "",
            placeholder: p.default
        }))

        setVariables(newVars)
        setVariablesPanelOpen(true)
        setSchemaPanelOpen(false)
        toast.info(`Şablon yüklendi: ${template.name}`)
    }, [])

    // SQL'deki Nunjucks (Jinja) pattern'lerinden otomatik kriter oluştur (debounced)
    useEffect(() => {
        // Kullanıcı yazmayı bitirene kadar bekle (500ms)
        const timeoutId = setTimeout(() => {
            // Nunjucks Etiket tipleri:
            // 1. {{ var }}, {{ var.sub }}, {{ var | filter }}
            // 2. {% if var %}, {% elif var %}, {% for item in var %}
            const foundVariables: string[] = []

            // Re-usable variables to ignore (Built-in keywords or globals)
            const ignoredKeywords = new Set([
                'if', 'else', 'elif', 'endif', 'for', 'in', 'endfor',
                'set', 'filter', 'endfilter', 'macro', 'endmacro',
                'include', 'import', 'extends', 'block', 'endblock',
                'and', 'or', 'not', 'true', 'false', 'null', 'none',
                'now', 'loop', 'range', 'item'
            ])

            // {{ ... }} içindeki değişkenleri bul (Fonksiyonel kolon ismi ve filtre argümanları desteği ile)
            // Örn: {{ VAR('COL') | between(offset=1) }}
            const expressionMatches = query.matchAll(/\{\{\s*([\w.]+)(?:\((?:['"]?)(.*?)(?:['"]?)\))?(?:\s*\|\s*[\w]+(?:\(.*?\))?)*\s*\}\}/g)

            for (const match of expressionMatches) {
                // match[1] değişken adını, match[2] ise opsiyonel kolon adını yakalar
                const baseVar = match[1].split('.')[0]
                if (baseVar && !ignoredKeywords.has(baseVar) && !foundVariables.includes(baseVar)) {
                    foundVariables.push(baseVar)
                }
            }


            // {% ... %} içindeki değişkenleri bul (if, elif, for in)
            const tagMatches = query.matchAll(/\{%\s*(?:if|elif|for|set)\s+([^%]+)%}/g)
            for (const match of tagMatches) {
                const content = match[1]
                // İçerikteki kelimeleri ayır ve değişken olabilecekleri bul
                // Örn: "user == 'admin'", "item in items"
                const words = content.match(/\b[a-zA-Z_]\w*\b/g) || []
                for (const word of words) {
                    if (word && !ignoredKeywords.has(word) && !foundVariables.includes(word)) {
                        // Eğer 'item in items' yapısıysa, 'item' kelimesi döngü değişkenidir, onu sonraki kelimeye bakarak eleyebiliriz
                        // Ancak basitlik adına ignoredKeywords içinde 'item' olduğu için şanslıyız.
                        // Daha iyisi: Sadece gerçekten template dışından gelmesi muhtemel olanları al
                        foundVariables.push(word)
                    }
                }
            }

            // Eksik değişkenleri ekle
            setVariables(prev => {
                const existingNames = prev.map(v => v.name)
                const newVariables: Variable[] = []

                for (const varName of foundVariables) {
                    if (!existingNames.includes(varName)) {
                        newVariables.push({
                            id: `var_auto_${varName}`,
                            name: varName,
                            type: "text",
                            label: varName,
                            filterType: "input",
                            multiSelect: false,
                            defaultValue: "",
                            value: "",
                            required: true,
                            valuesSource: "custom",
                            customValues: "",
                        })
                    }
                }

                if (newVariables.length > 0) {
                    // İlk yeni değişkeni dışarıya taşıyıp useEffect sonunda işlem yapacağız
                    const firstNew = newVariables[0]
                    // Local selection trigger
                    latestAddedVarRef.current = firstNew
                    return [...prev, ...newVariables]
                }
                return prev
            })
        }, 500)

    }, [query])

    // Yeni eklenen kriteri seçme ve paneli açma mantığı
    const latestAddedVarRef = useRef<Variable | null>(null)
    useEffect(() => {
        if (latestAddedVarRef.current) {
            const varToSelect = latestAddedVarRef.current
            latestAddedVarRef.current = null

            // Eğer zaten bir seçim varsa ve paneli düzenliyorsa, otomatik odaklanma yapma
            // (kullanıcının çalışmasını bölmemek için)
            if (!selectedVariable) {
                setSelectedVariable(varToSelect)
                setVariablesPanelOpen(true)
                setSchemaPanelOpen(false)
            }
        }
    }, [variables, selectedVariable])


    // Jinja template işleme fonksiyonu - artık utils'den geliyor, burada sarmalıyoruz
    const processQuery = useCallback((sqlQuery: string) => {
        return processJinjaTemplate(sqlQuery, variables)
    }, [variables])

    const handleRunQuery = useCallback(async (queryToRun?: string) => {
        if (isLoading) return

        const targetQuery = typeof queryToRun === 'string' ? queryToRun : query

        // Check for missing required variables (using frontend logic for validation)
        const { missingVariables } = processQuery(targetQuery)
        const missingRequired = missingVariables.filter(v => v.required)
        if (missingRequired.length > 0) {
            const missingLabels = missingRequired.map(v => v.label).join(", ")
            toast.error(`Zorunlu kriterlerde değer eksik: ${missingLabels}`, {
                description: "Lütfen Kriterler panelinden bu alanlara değer girin."
            })
            setVariablesPanelOpen(true)
            setSchemaPanelOpen(false)
            return
        }

        setIsLoading(true)
        setResults([])
        setExecutionTime(undefined)
        setQueryStatus(null)

        // Prepare criteria
        const criteria: Record<string, any> = {};
        variables.forEach(v => {
            const val = v.value || v.defaultValue;
            if (val) criteria[v.name] = val;
        });

        const payload = activeTemplate
            ? { template: activeTemplate.name, criteria }
            : { query: targetQuery, criteria };

        console.log(">>> [Frontend] Running Query via Flight:", payload);

        try {
            const startTime = Date.now()
            const response = await fetch("/api/flight/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const duration = Date.now() - startTime;

            if (result.success) {
                setResults(result.data || [])
                setQueryStatus("completed")
                toast.success("Sorgu tamamlandı")
            } else {
                toast.error(`Hata: ${result.error}`)
                setQueryStatus(null)
            }
            setExecutionTime(duration)
        } catch (e: any) {
            console.error("Flight execution error:", e)
            toast.error("Sunucu hatası")
        } finally {
            setIsLoading(false)
        }
    }, [isLoading, query, variables, activeTemplate, processQuery])

    const handleCancelQuery = useCallback(async () => {
        // Flight currently doesn't support cancellation via this bridge
        toast.info("İptal işlemi şu an desteklenmiyor")
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
                                    <BreadcrumbLink href="/sql-query">sql-query</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>
                                        <input
                                            type="text"
                                            value={queryName}
                                            onChange={(e) => setQueryName(e.target.value)}
                                            className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1 text-foreground"
                                            placeholder="Sorgu adı..."
                                        />
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Template Selector */}
                        {templates.length > 0 && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 border-dashed">
                                        <FileText className="h-3.5 w-3.5" />
                                        {activeTemplate ? activeTemplate.name : "Şablon Seç"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="Şablon ara..." />
                                        <CommandList>
                                            <CommandEmpty>Şablon bulunamadı.</CommandEmpty>
                                            <CommandGroup heading="Rapor Şablonları">
                                                <CommandItem
                                                    onSelect={() => {
                                                        setActiveTemplate(null)
                                                        setQueryName("Yeni sorgu")
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <div className="flex flex-col">
                                                        <span>Boş Sorgu</span>
                                                        <span className="text-[10px] text-muted-foreground">Sıfırdan SQL yaz</span>
                                                    </div>
                                                    {activeTemplate === null && <Check className="ml-auto h-4 w-4" />}
                                                </CommandItem>
                                                {templates.map(t => (
                                                    <CommandItem
                                                        key={t.name}
                                                        onSelect={() => handleTemplateSelect(t)}
                                                        className="cursor-pointer"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span>{t.description || t.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{t.name}</span>
                                                        </div>
                                                        {activeTemplate?.name === t.name && <Check className="ml-auto h-4 w-4" />}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* Gizli file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".yaml,.yml"
                            onChange={handleLoadFromYaml}
                            className="hidden"
                        />
                        <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/10" onClick={handleSaveToServer}>
                            <Save className="h-3.5 w-3.5" />
                            Kaydet
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenFileClick}>
                            <Upload className="h-3.5 w-3.5" />
                            Yükle
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveToYaml}>
                            <Download className="h-3.5 w-3.5" />
                            İndir
                        </Button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Editor & Results Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Database Selector & Editor - Tam ekranda gizle */}
                        {!isResultsFullscreen && (
                            <div className={`flex flex-col ${activeTab === 'api' ? 'flex-1 overflow-hidden' : ''}`} ref={containerRef}>
                                {/* Database Selector Area */}
                                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                                        {mounted && (
                                            <Popover open={isConnOpen} onOpenChange={setIsConnOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        role="combobox"
                                                        aria-expanded={isConnOpen}
                                                        className="h-7 w-[220px] justify-between text-xs px-2 hover:bg-muted/50 font-normal shadow-none border-none"
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            {selectedConnectionId
                                                                ? sampleConnections.find((c) => c.id === selectedConnectionId)?.name
                                                                : "Bağlantı seçin..."}
                                                        </div>
                                                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[220px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Bağlantı ara..." className="h-8 text-xs" />
                                                        <CommandList>
                                                            <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">Bağlantı bulunamadı.</CommandEmpty>
                                                            <CommandGroup>
                                                                {sampleConnections.map((conn) => (
                                                                    <CommandItem
                                                                        key={conn.id}
                                                                        value={conn.name}
                                                                        onSelect={() => {
                                                                            setSelectedConnectionId(conn.id)
                                                                            setIsConnOpen(false)
                                                                        }}
                                                                        className="text-xs py-2"
                                                                    >
                                                                        <Check
                                                                            className={`mr-2 h-3.5 w-3.5 transition-opacity ${selectedConnectionId === conn.id ? "opacity-100" : "opacity-0"
                                                                                }`}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span>{conn.name}</span>
                                                                            <span className="text-[10px] text-muted-foreground uppercase font-mono">{conn.type}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Tabs
                                            value={activeTab}
                                            onValueChange={(val) => setActiveTab(val as "edit" | "preview" | "api")}
                                            className="w-auto"
                                        >
                                            {mounted && (
                                                <TabsList className="inline-flex h-9 p-1 bg-muted rounded-lg">
                                                    <TabsTrigger
                                                        value="edit"
                                                        className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                                                    >
                                                        Query
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="preview"
                                                        className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                                                    >
                                                        SQL
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="api"
                                                        className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                                                    >
                                                        API
                                                    </TabsTrigger>
                                                </TabsList>
                                            )}
                                        </Tabs>
                                        <div className="flex items-center p-1 bg-muted rounded-lg h-9">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-full px-3 text-xs gap-2 rounded-md hover:bg-background/50 hover:text-foreground transition-all font-medium ${schemaPanelOpen ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                                                onClick={() => {
                                                    if (schemaPanelOpen) {
                                                        setSchemaPanelOpen(false)
                                                    } else {
                                                        setSchemaPanelOpen(true)
                                                        setVariablesPanelOpen(false)
                                                    }
                                                }}
                                            >
                                                <Database className="h-3.5 w-3.5" />
                                                Şema
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-full px-3 text-xs gap-2 rounded-md hover:bg-background/50 hover:text-foreground transition-all font-medium ${variablesPanelOpen ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                                                onClick={() => {
                                                    if (variablesPanelOpen) {
                                                        setVariablesPanelOpen(false)
                                                    } else {
                                                        setVariablesPanelOpen(true)
                                                        setSchemaPanelOpen(false)
                                                    }
                                                }}
                                            >
                                                <Settings2 className="h-3.5 w-3.5" />
                                                Kriterler
                                                {variables.length > 0 && (
                                                    <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${variablesPanelOpen ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                                                        {variables.length}
                                                    </span>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* SQL Editor */}
                                {activeTab === "api" ? (
                                    <div className="p-4 overflow-auto bg-muted/10 font-mono text-xs flex-1 h-full">
                                        <div className="mb-4">
                                            <div className="relative group">
                                                <div className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 rounded-md font-mono text-xs overflow-x-auto border border-zinc-200 dark:border-zinc-800">
                                                    POST http://localhost:3000/sql-query/{slug || 'api/execute'}
                                                </div>
                                                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CopyButton text={`POST http://localhost:3000/sql-query/${slug || 'api/execute'}`} />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <div>
                                                <div className="font-semibold mb-2 text-muted-foreground">Example Request (cURL)</div>
                                                <div className="relative group">
                                                    <pre className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 rounded-md font-mono text-xs overflow-x-auto whitespace-pre border border-zinc-200 dark:border-zinc-800">
                                                        <code>{(() => {
                                                            const renderVariables = (vars: Variable[]) => {
                                                                return vars.map(v => {
                                                                    const val = v.value || v.defaultValue
                                                                    if (v.filterType === 'between') {
                                                                        const formatDate = (d: any) => {
                                                                            const s = String(d || "")
                                                                            if (s && /^\d{8}$/.test(s)) {
                                                                                return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
                                                                            }
                                                                            return d || ""
                                                                        }

                                                                        let start = v.betweenStart || ""
                                                                        let end = v.betweenEnd || ""

                                                                        if (val) {
                                                                            try {
                                                                                const parsed = JSON.parse(val)
                                                                                if (parsed && typeof parsed === 'object') {
                                                                                    if (parsed.start) start = parsed.start
                                                                                    if (parsed.end) end = parsed.end
                                                                                }
                                                                            } catch { }
                                                                        }

                                                                        const formatted = {
                                                                            begin: formatDate(start),
                                                                            end: formatDate(end)
                                                                        }
                                                                        return `\n      "${v.name}": ${JSON.stringify(formatted)}`
                                                                    }
                                                                    if (v.filterType === 'dropdown' && v.multiSelect) {
                                                                        return `\n      "${v.name}": ${val || '[]'}`
                                                                    }
                                                                    if (v.type === 'number') {
                                                                        return `\n      "${v.name}": ${val || 'null'}`
                                                                    }
                                                                    return `\n      "${v.name}": "${val}"`
                                                                }).join(',')
                                                            }
                                                            const curlBody = `curl -X POST http://localhost:3000/sql-query/${slug || 'api/execute'} \\
  -H "Content-Type: application/json" \\
  -d '{
    "variables": {${renderVariables(variables)}
    }
  }'`
                                                            return curlBody
                                                        })()}</code>
                                                    </pre>
                                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <CopyButton text={(() => {
                                                            const renderVariables = (vars: Variable[]) => {
                                                                return vars.map(v => {
                                                                    const val = v.value || v.defaultValue
                                                                    if (v.filterType === 'between') {
                                                                        const formatDate = (d: any) => {
                                                                            const s = String(d || "")
                                                                            if (s && /^\d{8}$/.test(s)) {
                                                                                return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
                                                                            }
                                                                            return d || ""
                                                                        }

                                                                        let start = v.betweenStart || ""
                                                                        let end = v.betweenEnd || ""

                                                                        if (val) {
                                                                            try {
                                                                                const parsed = JSON.parse(val)
                                                                                if (parsed && typeof parsed === 'object') {
                                                                                    if (parsed.start) start = parsed.start
                                                                                    if (parsed.end) end = parsed.end
                                                                                }
                                                                            } catch { }
                                                                        }

                                                                        const formatted = {
                                                                            begin: formatDate(start),
                                                                            end: formatDate(end)
                                                                        }
                                                                        return `\n      "${v.name}": ${JSON.stringify(formatted)}`
                                                                    }
                                                                    if (v.filterType === 'dropdown' && v.multiSelect) {
                                                                        return `\n      "${v.name}": ${val || '[]'}`
                                                                    }
                                                                    if (v.type === 'number') {
                                                                        return `\n      "${v.name}": ${val || 'null'}`
                                                                    }
                                                                    return `\n      "${v.name}": "${val}"`
                                                                }).join(',')
                                                            }
                                                            return `curl -X POST http://localhost:3000/sql-query/${slug || 'api/execute'} \\
  -H "Content-Type: application/json" \\
  -d '{
    "variables": {${renderVariables(variables)}
    }
  }'`
                                                        })()} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <SQLEditor
                                        query={activeTab === "preview" ? processQuery(query).processedQuery : query}
                                        onQueryChange={(newQuery) => {
                                            if (activeTab === "edit") {
                                                setQuery(newQuery)
                                            }
                                        }}
                                        onRunQuery={handleRunQuery}
                                        onCancelQuery={handleCancelQuery}
                                        isLoading={isLoading}
                                        isDarkMode={isDarkMode}
                                        editorHeight={editorHeight}
                                        isResizing={isResizing}
                                        onResizeStart={handleResizeStart}
                                        readOnly={activeTab === "preview"}
                                    />
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {activeTab !== "api" && (
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
                        )}
                    </div>

                    {/* Schema Panel - Tam ekranda gizle */}
                    {schemaPanelOpen && !isResultsFullscreen && (
                        <div className="shrink-0 flex" style={{ width: sidePanelWidth }}>
                            {/* Resize Handle */}
                            <div
                                onMouseDown={handlePanelResizeStart}
                                className={`w-0 cursor-col-resize relative z-10 flex items-center justify-center`}
                            >
                                <div className={`absolute -left-1 w-2 h-full hover:bg-primary/20 transition-colors ${isResizingPanel ? 'bg-primary/30' : ''}`} />
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
                                className={`w-0 cursor-col-resize relative z-10 flex items-center justify-center`}
                            >
                                <div className={`absolute -left-1 w-2 h-full hover:bg-primary/20 transition-colors ${isResizingPanel ? 'bg-primary/30' : ''}`} />
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
        </SidebarProvider >
    )
}
