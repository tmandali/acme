"use client"

import React, { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Plus,
  Database,
  FileCode,
  Search,
  Terminal,
  ArrowRight,
  Activity,
  Clock,
  TrendingUp,
  Layers,
  Link as LinkIcon,
  MessageSquare,
  PlusCircle,
  Image as ImageIcon,
  ArrowUpCircle,
  Copy,
  ExternalLink,
  Zap,
  ChevronsUpDown,
  Check
} from "lucide-react"
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
import Link from "next/link"

// Quick Action - Matching Home Design
function QuickAction({
  title,
  href,
  icon: Icon,
  color = "text-muted-foreground",
}: {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between py-3 group border-b last:border-0"
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 transition-colors ${color}`} />
        <span className="text-sm font-light text-foreground/80 group-hover:text-foreground">{title}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
    </a>
  )
}

// Activity Item - Matching Home Design
function ActivityItem({
  title,
  description,
  time,
  icon: Icon,
  color = "text-muted-foreground/40",
  href,
}: {
  title: string
  description: string
  time: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${color}`} />}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground font-light">{description}</p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-light">{time}</span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className="flex items-center justify-between py-4 border-b last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded-md"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      {content}
    </div>
  )
}

export default function SQLQueryDashboard() {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchHistory] = useState([
    "select * from orders",
    "active customers report",
    "top selling products",
    "database connections guide"
  ])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showResults, setShowResults] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeQuery, setActiveQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<{ label: string; type: string; slug?: string; id?: number } | null>(null)
  const [isQueryConnOpen, setIsQueryConnOpen] = useState(false)
  const [isConnSelectorOpen, setIsConnSelectorOpen] = useState(false)

  // Dynamic queries state
  const [queries, setQueries] = useState<{ slug: string; name: string; sql: string }[]>([])

  // Fetch queries from server
  useEffect(() => {
    const fetchQueries = async () => {
      try {
        const response = await fetch("/api/sql-query/list")
        const data = await response.json()
        if (data.queries) {
          setQueries(data.queries)
        }
      } catch (error) {
        console.error("Error fetching queries:", error)
      }
    }
    fetchQueries()
  }, [])

  // Mock connections state
  // Connections state
  const [connections, setConnections] = useState<{ id: string | number; name: string; type: string }[]>([])

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
              id: c.id,
              name: c.name,
              type: c.type
            }))
            setConnections(mapped)
          }
        }
      } catch (e) {
        console.error("Failed to fetch connections", e)
      }
    }
    fetchConnections()
  }, [])

  // Simple filtering logic
  const filteredQueries = queries.filter(q =>
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredConnections = connections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Master data types
  const masterData = [
    { type: 'master' as const, label: "Kayıtlı Sorgular", icon: FileCode, href: "/sql-query", color: "text-primary" },
    { type: 'master' as const, label: "Veritabanı Bağlantıları", icon: Database, href: "/sql-query/connections", color: "text-orange-500" },
    { type: 'master' as const, label: "Veri Sözlüğü ve Şemalar", icon: Layers, href: "/sql-query/schema", color: "text-indigo-500" },
    { type: 'master' as const, label: "API Dokümantasyonu", icon: Terminal, href: "/sql-query/docs", color: "text-emerald-500" },
  ]

  const filteredMasterData = masterData.filter(m =>
    m.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const searchResults = selectedItem
    ? (
      selectedItem.label === "Kayıtlı Sorgular"
        ? filteredQueries.map(q => ({ type: 'query' as const, label: q.name, slug: q.slug }))
        : selectedItem.label === "Veritabanı Bağlantıları"
          ? filteredConnections.map(c => ({ type: 'connection' as const, label: c.name, id: c.id }))
          : []
    )
    : (searchTerm === ""
      ? searchHistory.map(item => ({ type: 'history' as const, label: item }))
      : [
        ...filteredMasterData,
        ...filteredQueries.map(q => ({ type: 'query' as const, label: q.name, slug: q.slug })),
        ...filteredConnections.map(c => ({ type: 'connection' as const, label: c.name, id: c.id }))
      ]
    )

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchTerm, isSearchFocused])

  const handleSearchSubmit = (query: string) => {
    if (!query.trim()) return
    setActiveQuery(query)
    setShowResults(true)
    setIsAnalyzing(true)
    setIsSearchFocused(false)
    setTimeout(() => setIsAnalyzing(false), 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchFocused) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Tab") {
      if (highlightedIndex >= 0) {
        const selected = searchResults[highlightedIndex] as any
        if (selected.type !== 'history') {
          e.preventDefault()
          setSelectedItem(selected)
          setSearchTerm("")
          setHighlightedIndex(-1)
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0) {
        const selected = searchResults[highlightedIndex] as any
        if (selected.type === 'history') {
          handleSearchSubmit(selected.label)
        } else if (selected.type === 'query') {
          window.location.href = `/sql-query/${selected.slug}`
        } else if (selected.type === 'connection') {
          window.location.href = `/sql-query/connections`
        } else if (selected.type === 'master') {
          window.location.href = selected.href
        }
      } else {
        handleSearchSubmit(searchTerm)
      }
    } else if (e.key === "Backspace" && searchTerm === "" && selectedItem) {
      setSelectedItem(null)
    } else if (e.key === "Escape") {
      setIsSearchFocused(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">SQL Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {!showResults ? (
            <div className="max-w-4xl mx-auto px-6 py-12">
              {/* Welcome Section */}
              <div className="mb-12">
                <h1 className="text-3xl font-light tracking-tight mb-1">
                  SQL Sorgu Paneli
                </h1>
                <p className="text-muted-foreground font-light">
                  Veritabanı bağlantılarını ve SQL sorgularınızı bu panelden yönetin
                </p>
              </div>

              {/* Search Box with History Dropdown (Unified Design) */}
              <div className={`mb-16 max-w-2xl mx-auto relative z-50 transition-all duration-300 ${isSearchFocused ? 'scale-[1.01]' : ''}`}>
                <div className={`relative flex items-center bg-background transition-all duration-200 border ${isSearchFocused
                  ? 'rounded-t-2xl border-border shadow-xl ring-1 ring-primary/5'
                  : 'rounded-xl border-border shadow-sm hover:shadow-md'
                  }`}>
                  {selectedItem ? (
                    <div className={`flex items-center gap-3 h-12 px-4 border-r border-border/30 transition-all animate-in slide-in-from-left-2 duration-300 ${selectedItem.type === 'query' ? 'bg-primary/[0.03]' :
                      selectedItem.type === 'connection' ? 'bg-orange-500/[0.03]' :
                        selectedItem.type === 'master' ? 'bg-muted/50' :
                          'bg-muted/30'
                      }`}>
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-foreground/80">
                        {selectedItem.type === 'query' && <FileCode className="h-3.5 w-3.5 text-primary" />}
                        {selectedItem.type === 'connection' && <Database className="h-3.5 w-3.5 text-orange-500" />}
                        {selectedItem.type === 'history' && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        {selectedItem.type === 'master' && (selectedItem as any).icon &&
                          React.createElement((selectedItem as any).icon, {
                            className: `h-3.5 w-3.5 ${(selectedItem as any).color}`
                          })
                        }
                        <span className="max-w-[150px] truncate uppercase">{selectedItem.label}</span>
                      </div>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="text-muted-foreground/30 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <div className="pl-4 flex items-center pointer-events-none">
                      <Search className={`h-4 w-4 transition-colors ${isSearchFocused ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder={selectedItem ? "Seçili kapsamda ara..." : "Sorgu, tablo veya bağlantı ara..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 h-12 pl-3 pr-4 bg-transparent outline-none text-sm font-light"
                  />
                </div>

                {/* Integrated Search Results Dropdown */}
                {isSearchFocused && (
                  <div className="absolute top-[47px] left-0 right-0 bg-background border-x border-b border-border rounded-b-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="mx-4 border-t border-border/50" />

                    {!selectedItem && searchTerm === "" ? (
                      <>
                        <div className="p-2 pt-3">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-1 block">Son Aramalar</span>
                        </div>
                        <div className="pb-3 px-1">
                          {searchHistory.map((item, index) => (
                            <button
                              key={index}
                              className={`w-full text-left px-4 py-2.5 text-sm font-light rounded-lg transition-colors flex items-center gap-3 group ${highlightedIndex === index ? 'bg-muted' : 'hover:bg-muted/50'
                                }`}
                              onClick={() => handleSearchSubmit(item)}
                            >
                              <Clock className={`h-3.5 w-3.5 transition-colors ${highlightedIndex === index ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                              <span className="flex-1">{item}</span>
                              <ArrowRight className={`h-3 w-3 text-muted-foreground transition-all -translate-x-1 ${highlightedIndex === index ? 'opacity-40 translate-x-0' : 'opacity-0 group-hover:opacity-40 group-hover:translate-x-0'}`} />
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="pb-3 max-h-[400px] overflow-auto">
                        {selectedItem ? (
                          <div className="p-2">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-2 block">
                              {selectedItem.label}
                            </span>
                            {searchResults.map((item: any, index: number) => (
                              <Link
                                key={item.slug || item.id || item.label}
                                href={item.type === 'query' ? `/sql-query/${item.slug}` : '/sql-query/connections'}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${highlightedIndex === index ? 'bg-muted' : 'hover:bg-muted'}`}
                              >
                                {item.type === 'query' && <FileCode className={`h-4 w-4 transition-colors ${highlightedIndex === index ? 'text-primary' : 'text-primary/60'}`} />}
                                {item.type === 'connection' && <Database className={`h-4 w-4 transition-colors ${highlightedIndex === index ? 'text-orange-500' : 'text-orange-500/60'}`} />}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{item.label}</span>
                                  {item.slug && <span className="text-[10px] font-mono text-muted-foreground">{item.slug}</span>}
                                </div>
                                <ArrowRight className={`ml-auto h-3 w-3 text-muted-foreground transition-all ${highlightedIndex === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <>
                            {/* Master Data Section */}
                            {filteredMasterData.length > 0 && (
                              <div className="p-2">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-2 block">Ana Veri Tipleri</span>
                                {filteredMasterData.map((item, index) => {
                                  const globalIndex = index
                                  return (
                                    <Link
                                      key={item.label}
                                      href={item.href}
                                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${highlightedIndex === globalIndex ? 'bg-muted' : 'hover:bg-muted'
                                        }`}
                                    >
                                      <item.icon className={`h-4 w-4 transition-colors ${highlightedIndex === globalIndex ? item.color : `${item.color}/60`}`} />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{item.label}</span>
                                      </div>
                                      <ArrowRight className={`ml-auto h-3 w-3 text-muted-foreground transition-all ${highlightedIndex === globalIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </Link>
                                  )
                                })}
                              </div>
                            )}

                            {/* Queries Section */}
                            {filteredQueries.length > 0 && (
                              <div className="p-2 pt-0">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-2 block">Sorgular</span>
                                {filteredQueries.map((query, index) => {
                                  const globalIndex = filteredMasterData.length + index
                                  return (
                                    <Link
                                      key={query.slug}
                                      href={`/sql-query/${query.slug}`}
                                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${highlightedIndex === globalIndex ? 'bg-muted' : 'hover:bg-muted'
                                        }`}
                                    >
                                      <FileCode className={`h-4 w-4 transition-colors ${highlightedIndex === globalIndex ? 'text-primary' : 'text-primary/60'}`} />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{query.name}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">{query.slug}</span>
                                      </div>
                                      <ArrowRight className={`ml-auto h-3 w-3 text-muted-foreground transition-all ${highlightedIndex === globalIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </Link>
                                  )
                                })}
                              </div>
                            )}

                            {/* Connections Section */}
                            {filteredConnections.length > 0 && (
                              <div className="p-2 pt-0">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-2 block">Bağlantılar</span>
                                {filteredConnections.map((conn, index) => {
                                  const globalIndex = filteredMasterData.length + filteredQueries.length + index
                                  return (
                                    <Link
                                      key={conn.id}
                                      href="/sql-query/connections"
                                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${highlightedIndex === globalIndex ? 'bg-muted' : 'hover:bg-muted'
                                        }`}
                                    >
                                      <Database className={`h-4 w-4 transition-colors ${highlightedIndex === globalIndex ? 'text-orange-500' : 'text-orange-500/60'}`} />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{conn.name}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{conn.type}</span>
                                      </div>
                                      <ArrowRight className={`ml-auto h-3 w-3 text-muted-foreground transition-all ${highlightedIndex === globalIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </Link>
                                  )
                                })}
                              </div>
                            )}

                            {filteredQueries.length === 0 && filteredConnections.length === 0 && filteredMasterData.length === 0 && (
                              <div className="py-12 text-center">
                                <p className="text-sm text-muted-foreground font-light italic">Sonuç bulunamadı...</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Two Column Layout - Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Quick Actions (Hızlı İşlemler) */}
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-6">HIZLI İŞLEMLER</h2>
                  <div className="flex flex-col">
                    <QuickAction
                      title="Yeni Sorgu Oluştur"
                      icon={Plus}
                      href="/sql-query/new"
                      color="text-primary"
                    />
                    <QuickAction
                      title="Yeni Bağlantı Ekle"
                      icon={LinkIcon}
                      href="/sql-query/connections/new"
                      color="text-orange-500"
                    />
                    <QuickAction
                      title="Veri Sözlüğünü İncele"
                      icon={Layers}
                      href="/sql-query/schema"
                      color="text-indigo-500"
                    />
                    <QuickAction
                      title="API Dokümantasyonu"
                      icon={Terminal}
                      href="/sql-query/docs"
                      color="text-emerald-500"
                    />
                  </div>
                </div>

                {/* Recent Activities (Son Sorgular) */}
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-6">SON AKTİVİTELER</h2>
                  <div className="flex flex-col">
                    {queries.map((query) => (
                      <ActivityItem
                        key={query.slug}
                        title={query.name}
                        description={`${query.slug}.yaml üzerinden başarıyla çalıştırıldı`}
                        time="2dk"
                        icon={FileCode}
                        color="text-primary/60"
                        href={`/sql-query/${query.slug}`}
                      />
                    ))}
                    <ActivityItem
                      title="Bağlantı Kuruldu"
                      description="Production ERP veritabanı bağlantısı aktifleştirildi"
                      time="15dk"
                      icon={Database}
                      color="text-orange-500/60"
                    />
                  </div>
                </div>
              </div>

              {/* Two Column Layout - Row 2 */}
              <div className="mt-20 grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Master Data (Ana Veriler) */}
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-6">ANA VERİLER</h2>
                  <div className="flex flex-col">
                    {/* Kayıtlı Sorgular - Searchable */}
                    <div className="border-b">
                      <Popover open={isQueryConnOpen} onOpenChange={setIsQueryConnOpen}>
                        <PopoverTrigger asChild>
                          <button className="w-full flex items-center justify-between py-3 group hover:bg-muted/30 transition-colors px-1 rounded-md">
                            <div className="flex items-center gap-3">
                              <FileCode className="h-4 w-4 text-primary" />
                              <span className="text-sm font-light text-foreground/80 group-hover:text-foreground text-left">Kayıtlı Sorgular (Bul...)</span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-all" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Sorgu ara..." className="h-8 text-xs" />
                            <CommandList>
                              <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">Sorgu bulunamadı.</CommandEmpty>
                              <CommandGroup>
                                {queries.map((q) => (
                                  <CommandItem
                                    key={q.slug}
                                    value={q.name}
                                    onSelect={() => {
                                      window.location.href = `/sql-query/${q.slug}`
                                    }}
                                    className="text-xs py-2"
                                  >
                                    <FileCode className="mr-2 h-3.5 w-3.5 text-primary/60" />
                                    <div className="flex flex-col">
                                      <span>{q.name}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono">{q.slug}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Veritabanı Bağlantıları - Searchable */}
                    <div className="border-b">
                      <Popover open={isConnSelectorOpen} onOpenChange={setIsConnSelectorOpen}>
                        <PopoverTrigger asChild>
                          <button className="w-full flex items-center justify-between py-3 group hover:bg-muted/30 transition-colors px-1 rounded-md">
                            <div className="flex items-center gap-3">
                              <Database className="h-4 w-4 text-orange-500" />
                              <span className="text-sm font-light text-foreground/80 group-hover:text-foreground text-left">Veritabanı Bağlantıları (Bul...)</span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-all" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Bağlantı ara..." className="h-8 text-xs" />
                            <CommandList>
                              <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">Bağlantı bulunamadı.</CommandEmpty>
                              <CommandGroup>
                                {connections.map((conn) => (
                                  <CommandItem
                                    key={conn.id}
                                    value={conn.name}
                                    onSelect={() => {
                                      window.location.href = `/sql-query/connections`
                                    }}
                                    className="text-xs py-2"
                                  >
                                    <Database className="mr-2 h-3.5 w-3.5 text-orange-500/60" />
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
                    </div>

                    <QuickAction
                      title="Veri Sözlüğü ve Şemalar"
                      icon={Layers}
                      href="/sql-query/schema"
                      color="text-indigo-500"
                    />
                    <QuickAction
                      title="API Dokümantasyonu"
                      icon={Terminal}
                      href="/sql-query/docs"
                      color="text-emerald-500"
                    />
                  </div>
                </div>

                {/* Reports (Raporlar) */}
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-6">RAPORLAR</h2>
                  <div className="flex flex-col">
                    <QuickAction
                      title="Sorgu Kullanım Analizi"
                      icon={Activity}
                      href="/sql-query/reports/usage"
                    />
                    <QuickAction
                      title="Bağlantı İstatistikleri"
                      icon={TrendingUp}
                      href="/sql-query/reports/connections"
                    />
                    <QuickAction
                      title="Hata Günlükleri (Logs)"
                      icon={Terminal}
                      href="/sql-query/reports/logs"
                    />
                    <QuickAction
                      title="Haftalık Sorgu Özeti"
                      icon={Clock}
                      href="/sql-query/reports/summary"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Refined Results Header - Compact & Aligned */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-md z-40 py-4 mb-8">
                <div className="max-w-3xl mx-auto px-6 flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <Search className="h-4 w-4 text-primary/60" />
                    <span className="text-sm font-medium tracking-tight text-foreground/80">{activeQuery}</span>
                  </div>
                  <button
                    onClick={() => setShowResults(false)}
                    className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40 hover:text-primary transition-colors border border-border/50 px-2 py-0.5 rounded"
                  >
                    ESC KAPAT
                  </button>
                </div>
              </div>

              <div className="space-y-10 pb-32 max-w-3xl mx-auto px-6">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-[0.3em] whitespace-nowrap">
                      {isAnalyzing ? "ANALİZ YÜRÜTÜLÜYOR..." : "SİSTEM RAPORU"}
                    </p>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>

                  <div className={`transition-all duration-700 ${isAnalyzing ? 'opacity-30 blur-[1px]' : 'opacity-100 blur-0'}`}>
                    <p className="text-xl font-light tracking-tight leading-relaxed mb-8 text-foreground/80 max-w-2xl">
                      SQL Sorgu modülü mimarisi, yüksek performanslı veri işleme standartlarını temel alır.
                    </p>

                    <div className="space-y-8">
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="h-3 w-3 text-primary/60" />
                          <h2 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold">SİSTEM BİLEŞENLERİ</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 border border-border/60 rounded-lg bg-card/30 hover:bg-muted/30 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="h-6 w-6 rounded bg-primary/5 flex items-center justify-center border border-primary/10">
                                <Terminal className="h-3 w-3 text-primary/60" />
                              </div>
                              <Copy className="h-3 w-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" />
                            </div>
                            <h3 className="text-xs font-semibold mb-1 font-mono">/api/sql-query/list</h3>
                            <p className="text-[11px] text-muted-foreground/60 font-light leading-snug">Kayıtlı sorgu tanımlarını JSON şemasıyla sunar.</p>
                          </div>
                          <div className="p-4 border border-border/60 rounded-lg bg-card/30 hover:bg-muted/30 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="h-6 w-6 rounded bg-orange-500/5 flex items-center justify-center border border-orange-500/10">
                                <Database className="h-3 w-3 text-orange-500/60" />
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" />
                            </div>
                            <h3 className="text-xs font-semibold mb-1">Bağlantı Katmanı</h3>
                            <p className="text-[11px] text-muted-foreground/60 font-light leading-snug">Dinamik havuz izleme ve sorgu optimizasyonu.</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <Layers className="h-3 w-3 text-primary/60" />
                          <h2 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold">MİMARİ STANDARTLAR</h2>
                        </div>
                        <div className="border border-border/60 rounded-lg divide-y divide-border/60 overflow-hidden shadow-sm">
                          {[
                            { title: "Frameless Estetik", desc: "Edge-to-edge görünüm ve keskin tipografik düzen.", icon: Zap },
                            { title: "Veri Entegrasyonu", desc: "Complex SQL operasyonlarını basitleştiren navigasyon.", icon: Activity },
                            { title: "Mikro-Etkileşimler", desc: "Durumsal geri bildirim veren akıcı geçişler.", icon: LinkIcon }
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-card/20 hover:bg-muted/10 transition-all group cursor-default">
                              <div className="h-7 w-7 rounded bg-muted/30 flex items-center justify-center shrink-0 border border-border/40 group-hover:bg-primary/5 transition-colors">
                                <item.icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xs font-medium group-hover:text-primary transition-colors">{item.title}</h3>
                                <p className="text-[10px] text-muted-foreground/50 font-light leading-tight">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>

                {/* Ultra-Compact Followup Area */}
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                  <div className="bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-1.5 focus-within:ring-1 ring-primary/10 transition-all">
                    <textarea
                      placeholder="Ek sorunuzu buraya yazın..."
                      className="w-full bg-transparent border-0 outline-none px-3 py-1.5 text-xs font-light resize-none h-9 min-h-[36px]"
                    />
                    <div className="flex items-center justify-between px-3 pb-1 pt-1.5 border-t border-border/20">
                      <div className="flex items-center gap-3">
                        <button className="text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1">
                          <PlusCircle className="h-3 w-3" />
                          <span className="text-[8px] uppercase tracking-widest font-bold">EKLE</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.1em] font-bold">SİSTEM ANALİSTİ</div>
                        <button className="h-6 w-6 bg-primary/5 hover:bg-primary rounded flex items-center justify-center transition-all group shadow-inner">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary-foreground transition-all" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
