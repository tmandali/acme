"use client"
// Force rebuild

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
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
import { Button } from "@/components/ui/button"
import {
    Database,
    Settings2,
    Save,
    Upload,
    Download,
    RefreshCw,
} from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

// Bileşenler
import { SchemaPanel } from "./schema-panel"
import { VariablesPanel } from "./variables-panel"
import { ResultsTableGlide as ResultsTable } from "./results-table-glide"
import { SQLEditor, SQLEditorRef } from "./sql-editor"
import { ConnectionSelector } from "./connection-selector"
import { CopyButton } from "./copy-button"
import { ApiTabContent } from "./api-tab-content"
import { SQLToolbar } from "./sql-toolbar"


// Tipler ve Veriler
import type { Variable, QueryFile, Schema } from "../lib/types"
import { sampleSchema, sampleResults } from "../lib/data"
import { processJinjaTemplate, findVariablesInQuery } from "../lib/utils"

interface SQLQueryPageClientProps {
    initialData?: QueryFile
    slug?: string
}

import { useQueryExecution } from "../hooks/use-query-execution"

export default function SQLQueryPageClient({ initialData, slug }: SQLQueryPageClientProps) {
    const [query, setQuery] = useState(initialData?.sql || "")
    const [isSaving, setIsSaving] = useState(false)
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
    const [selectedConnectionId, setSelectedConnectionId] = useState(initialData?.connectionId ? String(initialData.connectionId) : "default")
    const [isConnOpen, setIsConnOpen] = useState(false)
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)
    const [refreshingTables, setRefreshingTables] = useState<Set<string>>(new Set())
    const [tableStats, setTableStats] = useState<Record<string, { lastRefreshedAt: number, durationMs: number }>>({})
    const containerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editorRef = useRef<SQLEditorRef>(null)

    const [sessionId, setSessionId] = useState<string>("");

    // Sync state with initialData props when navigating between queries
    // Sync state with initialData props when navigating between queries
    const prevSlugRef = useRef(slug)
    useEffect(() => {
        // Only update state if slug changes or if we are mounting a new query (initialData exists and it's different logic)
        // Using slug comparison prevents re-loading data if parent re-renders but we are on same query
        if (initialData && slug !== prevSlugRef.current) {
            setQuery(initialData.sql || "")
            setQueryName(initialData.name || "Yeni sorgu")
            setVariables(initialData.variables || [])
            setSelectedConnectionId(initialData.connectionId ? String(initialData.connectionId) : "default")
            prevSlugRef.current = slug
        }
    }, [initialData, slug])

    // Helper to fetch new session
    const fetchNewSession = useCallback(async () => {
        try {
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actionType: "create_session" })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.session_id) {
                    return data.session_id;
                }
                throw new Error("Mising session_id in response");
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server error: ${res.status} ${res.statusText}`);
            }
        } catch (e: any) {
            console.error("Failed to create session on server, falling back to local:", e.message);
            // Fallback
            return "Session_Local_" + Math.random().toString(36).substring(2, 7).toUpperCase();
        }
    }, []);

    useEffect(() => {
        setMounted(true);

        const initSession = async () => {
            let id = "";
            let urlSession = null;

            if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                urlSession = params.get("session_id");

                // If ID provided in URL, prioritize it
                if (urlSession) {
                    id = urlSession;
                } else {
                    // Check local storage
                    const stored = localStorage.getItem("acme_session_id");
                    if (stored) {
                        id = stored;
                    }
                }
            }

            // If still no ID, create one from server
            if (!id) {
                id = await fetchNewSession();
            }

            // Sync storage
            if (typeof window !== "undefined") {
                localStorage.setItem("acme_session_id", id);
                // If URL had session, maybe we want to keep it or clear it? 
                // Keeping it simplest for now.
            }

            setSessionId(id);
        };

        initSession();
    }, [fetchNewSession]);

    const [dbSchema, setDbSchema] = useState<Schema>({ name: "Veritabanı Bağlanıyor...", models: [], tables: [] })
    const queryStatusRef = useRef<"completed" | "cancelled" | null>(null)
    const [connections, setConnections] = useState<{ id: string, name: string, type: string }[]>([
        { id: "default", name: "Memory", type: "Engine" }
    ])

    // Fetch connections from server
    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const res = await fetch("/api/flight/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ actionType: "list_connections" })
                })
                if (res.ok) {
                    const data = await res.json()
                    if (Array.isArray(data)) {
                        const mapped = data.map((c: any) => ({
                            id: String(c.id),
                            name: c.name,
                            type: c.type
                        }))
                        setConnections([
                            { id: "default", name: "Memory", type: "Engine" },
                            ...mapped
                        ])
                    }
                }
            } catch (e) {
                console.error("Failed to fetch connections", e)
            }
        }
        fetchConnections()
    }, [])

    // Schema Fetching
    const refreshSchema = useCallback(async () => {
        if (!sessionId) return; // Wait for session
        try {
            const res = await fetch(`/api/flight/schema?session_id=${sessionId}`, {
                headers: { "x-session-id": sessionId }
            })
            if (res.ok) {
                const data = await res.json()
                setDbSchema(data)
            }
        } catch (err) {
            console.error("Failed to fetch schema:", err)
        }
    }, [sessionId])

    // Drop Table
    const handleDropTable = useCallback(async (tableName: string, tableType?: string) => {
        if (!confirm(`Are you sure you want to drop ${tableType === 'VIEW' ? 'view' : 'table'} '${tableName}'?`)) {
            return;
        }

        try {
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actionType: "drop_table",
                    payload: { session_id: sessionId, table_name: tableName, table_type: tableType }
                })
            })

            const result = await res.json()
            if (result.success) {
                toast.success(`Table '${tableName}' dropped successfully.`)
                refreshSchema() // Refresh schema to disappear from list
            } else {
                toast.error(result.message || "Failed to drop table.")
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to drop table.")
        }
    }, [sessionId, refreshSchema])

    // Table Refresh Logic
    const lastRefreshedSessionRef = useRef<string | null>(null)
    useEffect(() => {
        if (mounted && sessionId && lastRefreshedSessionRef.current !== sessionId) {
            refreshSchema()
            lastRefreshedSessionRef.current = sessionId
        }
    }, [mounted, sessionId]) // Only run when session ID changes

    // Hook integration
    const {
        results,
        totalRows,
        setResults,
        isLoading,
        executionTime,
        queryStatus,
        errorDetail,
        setErrorDetail,
        handleRunQuery: executeQuery,
        handleCancelQuery,
        processQuery,
        executedQuery
    } = useQueryExecution({ variables, sessionId })

    const handleRefreshTable = useCallback(async (tableName: string) => {
        const startTime = Date.now()
        setRefreshingTables(prev => new Set(prev).add(tableName))
        try {
            const res = await fetch("/api/flight/refresh", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId
                },
                body: JSON.stringify({ tableName })
            })
            if (res.ok) {
                toast.success(`'${tableName}' tablosu güncellendi.`)
                // Stop spinning immediately after server success
                setRefreshingTables(prev => {
                    const next = new Set(prev)
                    next.delete(tableName)
                    return next
                })

                const duration = Date.now() - startTime
                setTableStats(prev => ({
                    ...prev,
                    [tableName]: {
                        lastRefreshedAt: Date.now(),
                        durationMs: duration
                    }
                }))

                await refreshSchema()
            } else {
                const errorData = await res.json().catch(() => ({}));
                const msg = errorData.error || "Bilinmeyen sunucu hatası";
                toast.error(`'${tableName}' güncellenirken hata oluştu.`, {
                    action: {
                        label: "Detay",
                        onClick: () => setErrorDetail(msg)
                    }
                })
            }
        } catch (err: any) {
            console.error("Manual refresh error:", err)
            toast.error(`'${tableName}' güncellenirken teknik bir hata oluştu.`, {
                action: {
                    label: "Detay",
                    onClick: () => setErrorDetail(err.message)
                }
            })
        } finally {
            // Guarantee removal just in case of error or missing branch
            setRefreshingTables(prev => {
                if (!prev.has(tableName)) return prev
                const next = new Set(prev)
                next.delete(tableName)
                return next
            })
        }
    }, [sessionId, refreshSchema, setErrorDetail])

    const handleNewSession = useCallback(async () => {
        if (!confirm("Yeni bir oturum başlatmak istediğinize emin misiniz? Mevcut oturumdaki geçici kayıtlar kaybolacaktır.")) {
            return;
        }

        const newId = await fetchNewSession();
        localStorage.setItem("acme_session_id", newId);

        // Clear UI states immediately to prevent stale data "lag"
        // This solves the perception that "cleaning takes time" or "old data comes from memory"
        setDbSchema({ name: "Memory Schema", models: [], tables: [] });
        setResults([]);
        setRefreshingTables(new Set());
        setTableStats({});

        setSessionId(newId);
        toast.info(`Yeni oturum başlatıldı: ${newId}`);
    }, [setResults, fetchNewSession]);

    const handleRunQueryWrapper = useCallback(async (queryToRun?: string) => {
        const targetQuery = typeof queryToRun === 'string' ? queryToRun : query
        const result = await executeQuery(targetQuery, selectedConnectionId)

        if (result?.missingRequired) {
            setVariablesPanelOpen(true)
            setSchemaPanelOpen(false)
        } else if (result?.success) {
            // Refresh schema after query, as reader tags might have added new tables
            refreshSchema()
        }
    }, [query, executeQuery, refreshSchema, selectedConnectionId])


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
            connectionId: selectedConnectionId,
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
        setIsSaving(true)
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
            setIsSaving(false)
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

                    // Bağlantıyı güncelle
                    if (parsed.connectionId) {
                        const targetId = String(parsed.connectionId)
                        const connectionExists = connections.some(c => String(c.id) === targetId)

                        if (connectionExists) {
                            setSelectedConnectionId(targetId)
                        } else {
                            // Bağlantı bulunamazsa Memory'ye (default) dön
                            setSelectedConnectionId("default")
                            toast.info(`Kayıtlı bağlantı bulunamadı (${targetId}), "Memory" seçildi.`)
                        }
                    } else {
                        // Dosyada bağlantı yoksa Memory seç
                        setSelectedConnectionId("default")
                    }

                    // Sonuçları temizle
                    setResults([])
                }
            } catch (error) {
                console.error("YAML dosyası yüklenirken hata oluştu:", error)
                toast.error("YAML dosyası yüklenirken hata oluştu. Lütfen geçerli bir dosya seçin.")
            }
        }
        reader.readAsText(file)

        // Input'u sıfırla (aynı dosyayı tekrar seçebilmek için)
        event.target.value = ''
    }, [connections])

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


    // SQL'deki Nunjucks (Jinja) pattern'lerinden değişkenleri tara ve ekle
    const handleScanVariables = useCallback((silent: boolean = false) => {
        const foundVariables = findVariablesInQuery(query)

        // Değişkenleri senkronize et (Ekle / Çıkar / Yeniden Adlandır)
        setVariables(prev => {
            const currentNames = new Set(prev.map(v => v.name))
            const foundSet = new Set(foundVariables)

            const addedNames = foundVariables.filter(name => !currentNames.has(name))
            const removedVars = prev.filter(v => !foundSet.has(v.name))

            // Heuristic: Eğer tam olarak 1 değişken silinip 1 değişken eklendiyse, bunu "Yeniden Adlandırma" olarak kabul et.
            // Bu sayede kullanıcının girdiği değerler ve ayarlar (label, value vb.) korunur.
            if (addedNames.length === 1 && removedVars.length === 1) {
                const oldVar = removedVars[0]
                const newName = addedNames[0]



                return prev.map(v => {
                    if (v.id === oldVar.id) {
                        return {
                            ...v,
                            name: newName,
                            // Label eğer eski isimle aynıysa (custom değilse) güncelle, değilse koru
                            label: v.label === v.name ? newName : v.label,
                        }
                    }
                    return v
                })
            }

            // Normal Senkronizasyon (Sadece yeni eklenenleri işle, silinenleri KORU)
            if (addedNames.length > 0) {
                // Silinenleri filtrelemiyoruz. Kullanıcı isteği: "daha önce tanımlı olan bir değişken templateten kaldırılsa bile silinmesin"
                const keptVars = prev;

                const newVars: Variable[] = addedNames.map(name => ({
                    id: `var_auto_${name}`,
                    name: name,
                    type: "text",
                    label: name,
                    filterType: "input",
                    multiSelect: false,
                    defaultValue: "",
                    value: "",
                    required: true,
                    valuesSource: "custom",
                    customValues: "",
                }))

                if (!silent) {
                    toast.success(`${addedNames.length} kriter eklendi.`)
                }

                // Yeni eklenen varsa seçim için ref'e ata
                if (newVars.length > 0) {
                    latestAddedVarRef.current = newVars[0]
                }

                return [...keptVars, ...newVars]
            }

            if (!silent) {
                toast.info("Değişiklik bulunamadı")
            }
            return prev
        })
    }, [query])

    // Auto-scan on query change with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleScanVariables(true)
        }, 700)
        return () => clearTimeout(timeoutId)
    }, [query, handleScanVariables])

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
                handleRunQueryWrapper()
            }
            // ESC ile tam ekrandan çık
            if (e.key === 'Escape' && isResultsFullscreen) {
                setIsResultsFullscreen(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleRunQueryWrapper, isResultsFullscreen])

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
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={queryName}
                                                onChange={(e) => setQueryName(e.target.value)}
                                                className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1 text-foreground"
                                                placeholder="Sorgu adı..."
                                            />
                                            {sessionId && (
                                                <div
                                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] uppercase tracking-wider font-bold text-primary border border-primary/20"
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="cursor-help" title="Sizin için özel olarak oluşturulmuş izole oturum ID'si">Session: {sessionId}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 rounded-full hover:bg-primary/20 text-primary p-0 ml-1"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (confirm("Yeni bir oturum başlatmak istediğinize emin misiniz? Mevcut oturumdaki geçici kayıtlar kaybolacaktır.")) {
                                                                handleNewSession();
                                                            }
                                                        }}
                                                        title="Yeni Oturum Başlat"
                                                    >
                                                        <RefreshCw className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Template Selector */}
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Gizli file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".yaml,.yml"
                                onChange={handleLoadFromYaml}
                                className="hidden"
                            />
                            <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/10" onClick={handleSaveToServer} disabled={isSaving}>
                                <Save className="h-3.5 w-3.5" />
                                {isSaving ? "Kaydediliyor..." : "Kaydet"}
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
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Editor & Results Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Database Selector & Editor - Tam ekranda gizle */}
                        {!isResultsFullscreen && (
                            <div className={`flex flex-col ${activeTab === 'api' ? 'flex-1 overflow-hidden' : ''}`} ref={containerRef}>
                                {/* Toolbar */}
                                <SQLToolbar
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    schemaPanelOpen={schemaPanelOpen}
                                    setSchemaPanelOpen={setSchemaPanelOpen}
                                    variablesPanelOpen={variablesPanelOpen}
                                    setVariablesPanelOpen={setVariablesPanelOpen}
                                    variables={variables}
                                    selectedConnectionId={selectedConnectionId}
                                    setSelectedConnectionId={setSelectedConnectionId}
                                    isConnOpen={isConnOpen}
                                    setIsConnOpen={setIsConnOpen}
                                    connections={connections}
                                    mounted={mounted}
                                />

                                {/* SQL Editor */}
                                {activeTab === "api" ? (
                                    <ApiTabContent slug={slug} variables={variables} />
                                ) : (
                                    <SQLEditor
                                        ref={editorRef}
                                        query={activeTab === "preview" ? processQuery(query).processedQuery : query}
                                        onQueryChange={(newQuery) => {
                                            if (activeTab === "edit") {
                                                setQuery(newQuery)
                                            }
                                        }}
                                        onRunQuery={handleRunQueryWrapper}
                                        onCancelQuery={handleCancelQuery}
                                        isLoading={isLoading}
                                        isDarkMode={isDarkMode}
                                        editorHeight={editorHeight}
                                        isResizing={isResizing}
                                        onResizeStart={handleResizeStart}
                                        schema={dbSchema}
                                        readOnly={activeTab === "preview"}
                                    />
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {
                            activeTab !== "api" && (
                                <div className="flex-1 overflow-hidden">
                                    <ResultsTable
                                        results={results}
                                        totalRows={totalRows}
                                        isLoading={isLoading}
                                        executionTime={executionTime}
                                        queryStatus={queryStatus}
                                        error={errorDetail}
                                        executedQuery={executedQuery || undefined}
                                        connectionName={connections.find(c => c.id === selectedConnectionId)?.name}
                                        isFullscreen={isResultsFullscreen}
                                        onToggleFullscreen={() => setIsResultsFullscreen(prev => !prev)}
                                    />
                                </div>
                            )
                        }
                    </div >

                    {/* Schema Panel - Tam ekranda gizle */}
                    {
                        schemaPanelOpen && !isResultsFullscreen && (
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
                                        schema={dbSchema}
                                        onTableClick={handleTableClick}
                                        onRefreshTable={handleRefreshTable}
                                        onDropTable={handleDropTable}
                                        refreshingTables={refreshingTables}
                                        tableStats={tableStats}
                                        onClose={() => setSchemaPanelOpen(false)}
                                    />
                                </div>
                            </div>
                        )
                    }

                    {/* Variables Panel - Tam ekranda gizle */}
                    {
                        variablesPanelOpen && !isResultsFullscreen && (
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
                        )
                    }
                </div>
            </SidebarInset >
        </SidebarProvider >
    )
}
