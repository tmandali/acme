"use client"

import { useState, useEffect } from "react"
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
  Link as LinkIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Quick Action - Matching Home Design
function QuickAction({
  title,
  href,
  icon: Icon,
}: {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between py-3 group border-b last:border-0"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-light">{title}</span>
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
}: {
  title: string
  description: string
  time: string
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground font-light">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground font-light">{time}</span>
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

  // Mock queries state
  const [queries] = useState([
    { slug: "marketing-report", name: "Pazarlama Analizi", sql: "SELECT * FROM campaigns..." },
    { slug: "inventory-check", name: "Stok Durumu", sql: "SELECT item_name, qty FROM..." },
    { slug: "sales-overview", name: "Satış Özeti", sql: "SELECT total_sales FROM..." },
  ])

  // Mock connections state
  const [connections] = useState([
    { id: 1, name: "Production ERP", type: "PostgreSQL" },
    { id: 2, name: "Analytics DB", type: "BigQuery" },
    { id: 3, name: "Customer Portal", type: "MySQL" },
  ])

  // Simple filtering logic
  const filteredQueries = queries.filter(q =>
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredConnections = connections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const searchResults = searchTerm === ""
    ? searchHistory.map(item => ({ type: 'history', label: item }))
    : [
      ...filteredQueries.map(q => ({ type: 'query', label: q.name, slug: q.slug })),
      ...filteredConnections.map(c => ({ type: 'connection', label: c.name, id: c.id }))
    ]

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchTerm, isSearchFocused])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchFocused || searchResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      const selected = searchResults[highlightedIndex] as any
      if (selected.type === 'history') {
        setSearchTerm(selected.label)
      } else if (selected.type === 'query') {
        window.location.href = `/sql-query/${selected.slug}`
      } else if (selected.type === 'connection') {
        window.location.href = `/sql-query/connections`
      }
      setIsSearchFocused(false)
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
          <div className="max-w-5xl mx-auto px-6 py-12">

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
                <div className="pl-4 flex items-center pointer-events-none">
                  <Search className={`h-4 w-4 transition-colors ${isSearchFocused ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <input
                  type="text"
                  placeholder="Sorgu, tablo veya bağlantı ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-12 pl-3 pr-4 bg-transparent outline-none text-sm font-light"
                />

              </div>

              {/* Integrated Search Results Dropdown */}
              {isSearchFocused && (
                <div className="absolute top-[47px] left-0 right-0 bg-background border-x border-b border-border rounded-b-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="mx-4 border-t border-border/50" />

                  {searchTerm === "" ? (
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
                            onClick={() => setSearchTerm(item)}
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
                      {/* Queries Section */}
                      {filteredQueries.length > 0 && (
                        <div className="p-2">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 px-3 py-2 block">Sorgular</span>
                          {filteredQueries.map((query, index) => {
                            const globalIndex = index
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
                            const globalIndex = filteredQueries.length + index
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

                      {filteredQueries.length === 0 && filteredConnections.length === 0 && (
                        <div className="py-12 text-center">
                          <p className="text-sm text-muted-foreground font-light italic">Sonuç bulunamadı...</p>
                        </div>
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
                  />
                  <QuickAction
                    title="Yeni Bağlantı Ekle"
                    icon={LinkIcon}
                    href="/sql-query/connections/new"
                  />
                  <QuickAction
                    title="Veri Sözlüğünü İncele"
                    icon={Layers}
                    href="/sql-query/schema"
                  />
                  <QuickAction
                    title="API Dokümantasyonu"
                    icon={Terminal}
                    href="/sql-query/docs"
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
                    />
                  ))}
                  <ActivityItem
                    title="Bağlantı Kuruldu"
                    description="Production ERP veritabanı bağlantısı aktifleştirildi"
                    time="15dk"
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
                  <QuickAction
                    title="Kayıtlı Sorgular"
                    icon={FileCode}
                    href="/sql-query"
                  />
                  <QuickAction
                    title="Veritabanı Bağlantıları"
                    icon={Database}
                    href="/sql-query/connections"
                  />
                  <QuickAction
                    title="Veri Sözlüğü ve Şemalar"
                    icon={Layers}
                    href="/sql-query/schema"
                  />
                  <QuickAction
                    title="API Dokümantasyonu"
                    icon={Terminal}
                    href="/sql-query/docs"
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
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
