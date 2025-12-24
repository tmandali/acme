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
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
  CreditCard,
  ShoppingCart,
  BarChart3,
  Database,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react"

// Minimal Stat Card
function StatCard({
  title,
  value,
  change,
  changeType,
}: {
  title: string
  value: string
  change: string
  changeType: "up" | "down"
}) {
  return (
    <div className="p-6 border-b md:border-b-0 md:border-r last:border-r-0 last:border-b-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <p className="text-2xl font-light tracking-tight mb-1">{value}</p>
      <div className="flex items-center gap-1.5">
        {changeType === "up" ? (
          <TrendingUp className="h-3 w-3 text-foreground/70" />
        ) : (
          <TrendingDown className="h-3 w-3 text-foreground/70" />
        )}
        <span className="text-xs text-muted-foreground">
          {changeType === "up" ? "+" : "-"}{change} geçen aydan
        </span>
      </div>
    </div>
  )
}

// Minimal Quick Action
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
      className="flex items-center justify-between py-3 group"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{title}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
    </a>
  )
}

// Minimal Activity Item
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
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  )
}

// SQL Query Item
function SQLQueryItem({
  slug,
  name,
  variablesCount,
  onCopy,
}: {
  slug: string
  name: string
  variablesCount: number
  onCopy: (slug: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCopy(slug)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <a
      href={`/sql-query/${slug}`}
      className="group flex items-center justify-between py-3 px-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Database className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            {variablesCount > 0 ? `${variablesCount} kriter` : "Kriter yok"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  )
}

// SQL Query Dashboard Section
function SQLQueryDashboard() {
  const [queries, setQueries] = useState<Array<{
    slug: string
    name: string
    variablesCount: number
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/sql-query/list")
      .then(res => res.json())
      .then(data => {
        setQueries(data.queries || [])
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/sql-query/${slug}`
    navigator.clipboard.writeText(url)
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">SQL Sorguları</h2>
        </div>
        <div className="space-y-2">
          <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">SQL Sorguları</h2>
        <a
          href="/sql-query"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tümünü gör
        </a>
      </div>
      {queries.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <Database className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Henüz sorgu yok</p>
          <a
            href="/sql-query"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Yeni sorgu oluştur
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {queries.slice(0, 4).map((query) => (
            <SQLQueryItem
              key={query.slug}
              slug={query.slug}
              name={query.name}
              variablesCount={query.variablesCount}
              onCopy={handleCopyLink}
            />
          ))}
          {queries.length > 4 && (
            <a
              href="/sql-query"
              className="flex items-center justify-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              +{queries.length - 4} sorgu daha
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        {/* Header - Sabit */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">Ana Sayfa</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Main Content - Kaydırılabilir */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Welcome */}
            <div className="mb-12">
              <h1 className="text-3xl font-light tracking-tight mb-1">
                Hoş geldiniz
              </h1>
              <p className="text-muted-foreground">
                İşletmenizin güncel durumuna göz atın
              </p>
            </div>

            {/* Stats */}
            <div className="border rounded-lg bg-card mb-12 grid grid-cols-1 md:grid-cols-4">
              <StatCard
                title="Toplam Gelir"
                value="₺847,250"
                change="12.5%"
                changeType="up"
              />
              <StatCard
                title="Satış Siparişleri"
                value="1,247"
                change="8.2%"
                changeType="up"
              />
              <StatCard
                title="Stok Ürünleri"
                value="3,842"
                change="2.4%"
                changeType="down"
              />
              <StatCard
                title="Aktif Müşteriler"
                value="892"
                change="18.7%"
                changeType="up"
              />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Quick Actions */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h2>
                <div className="divide-y">
                  <QuickAction
                    title="Satış Faturası Oluştur"
                    icon={FileText}
                    href="/accounting/sales-invoice/new"
                  />
                  <QuickAction
                    title="Ödeme Girişi Ekle"
                    icon={CreditCard}
                    href="/accounting/payment-entry"
                  />
                  <QuickAction
                    title="Satın Alma Siparişi"
                    icon={ShoppingCart}
                    href="/buying"
                  />
                  <QuickAction
                    title="Finansal Raporlar"
                    icon={BarChart3}
                    href="/accounting/reports"
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Son Aktiviteler</h2>
                <div className="divide-y">
                  <ActivityItem
                    title="Yeni Fatura"
                    description="INV-2024-0847 oluşturuldu"
                    time="2dk"
                  />
                  <ActivityItem
                    title="Ödeme Alındı"
                    description="₺12,500 - Atlas Ltd."
                    time="15dk"
                  />
                  <ActivityItem
                    title="Yeni Sipariş"
                    description="SO-2024-1423 onaylandı"
                    time="1sa"
                  />
                  <ActivityItem
                    title="Müşteri Eklendi"
                    description="Yıldız Holding A.Ş."
                    time="3sa"
                  />
                </div>
              </div>
            </div>

            {/* SQL Query Dashboard */}
            <div className="mt-12">
              <SQLQueryDashboard />
            </div>

            {/* Chart Section */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Revenue Chart */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Gelir Grafiği</h2>
                  <span className="text-xs text-muted-foreground">Son 6 ay</span>
                </div>
                <div className="h-48 flex items-end gap-2">
                  {[65, 40, 80, 55, 90, 75].map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-foreground/10 hover:bg-foreground/20 transition-colors rounded"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {["Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Products */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">En Çok Satan</h2>
                  <span className="text-xs text-muted-foreground">Bu ay</span>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "Ürün A - Premium", sales: 847, percent: 85 },
                    { name: "Ürün B - Standart", sales: 654, percent: 65 },
                    { name: "Ürün C - Ekonomik", sales: 423, percent: 42 },
                    { name: "Ürün D - Özel", sales: 312, percent: 31 },
                  ].map((product, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{product.name}</span>
                        <span className="text-muted-foreground text-xs">{product.sales}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/30 rounded-full"
                          style={{ width: `${product.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
