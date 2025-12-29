"use client"

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
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ClipboardList,
  Users,
  Package,
  FileText,
  Building2,
  MapPin,
  Tags,
  Wallet,
  BarChart3,
  PieChart,
  LineChart,
  FileBarChart,
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

export default function BuyingPage() {
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
                  <BreadcrumbPage className="text-sm font-medium">Satın Alma</BreadcrumbPage>
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
                Satın Alma
              </h1>
              <p className="text-muted-foreground">
                Satın alma siparişleri ve tedarikçi işlemlerini yönetin
              </p>
            </div>

            {/* Stats */}
            <div className="border rounded-lg bg-card mb-12 grid grid-cols-1 md:grid-cols-4">
              <StatCard
                title="Toplam Satın Alma"
                value="₺523,840"
                change="8.3%"
                changeType="up"
              />
              <StatCard
                title="Açık Siparişler"
                value="23"
                change="12.5%"
                changeType="up"
              />
              <StatCard
                title="Bekleyen Ödemeler"
                value="₺145,200"
                change="5.1%"
                changeType="down"
              />
              <StatCard
                title="Aktif Tedarikçiler"
                value="47"
                change="4.2%"
                changeType="up"
              />
            </div>

            {/* Two Column Layout - Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Quick Actions */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h2>
                <div className="divide-y">
                  <QuickAction
                    title="Satın Alma Siparişi Oluştur"
                    icon={ClipboardList}
                    href="/buying/purchase-order/new"
                  />
                  <QuickAction
                    title="Tedarikçi Ekle"
                    icon={Users}
                    href="/buying/supplier/new"
                  />
                  <QuickAction
                    title="Mal Kabul Girişi"
                    icon={Package}
                    href="/buying/purchase-receipt/new"
                  />
                  <QuickAction
                    title="Teklif Talebi Oluştur"
                    icon={FileText}
                    href="/buying/request-for-quotation/new"
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Son Siparişler</h2>
                <div className="divide-y">
                  <ActivityItem
                    title="PO-2024-0156"
                    description="Atlas Tedarik A.Ş. - ₺24,500"
                    time="2dk"
                  />
                  <ActivityItem
                    title="PO-2024-0155"
                    description="Yıldız Metal Ltd. - ₺18,750"
                    time="1sa"
                  />
                  <ActivityItem
                    title="PO-2024-0154"
                    description="Akdeniz Lojistik - ₺32,100"
                    time="3sa"
                  />
                  <ActivityItem
                    title="PO-2024-0153"
                    description="Delta Hammadde - ₺9,800"
                    time="1gün"
                  />
                </div>
              </div>
            </div>

            {/* Two Column Layout - Row 2 */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Master Data */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Ana Veriler</h2>
                <div className="divide-y">
                  <QuickAction
                    title="Tedarikçiler"
                    icon={Building2}
                    href="/buying/supplier"
                  />
                  <QuickAction
                    title="Tedarikçi Grupları"
                    icon={Users}
                    href="/buying/supplier-group"
                  />
                  <QuickAction
                    title="Adresler"
                    icon={MapPin}
                    href="/buying/address"
                  />
                  <QuickAction
                    title="Ürün Kategorileri"
                    icon={Tags}
                    href="/buying/item-group"
                  />
                  <QuickAction
                    title="Ödeme Koşulları"
                    icon={Wallet}
                    href="/buying/payment-terms"
                  />
                </div>
              </div>

              {/* Reports */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Raporlar</h2>
                <div className="divide-y">
                  <QuickAction
                    title="Satın Alma Analizi"
                    icon={BarChart3}
                    href="/buying/reports/purchase-analytics"
                  />
                  <QuickAction
                    title="Tedarikçi Performansı"
                    icon={LineChart}
                    href="/buying/reports/supplier-performance"
                  />
                  <QuickAction
                    title="Kategori Bazlı Harcama"
                    icon={PieChart}
                    href="/buying/reports/category-spending"
                  />
                  <QuickAction
                    title="Sipariş Özeti"
                    icon={FileBarChart}
                    href="/buying/reports/order-summary"
                  />
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Purchase Chart */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Satın Alma Grafiği</h2>
                  <span className="text-xs text-muted-foreground">Son 6 ay</span>
                </div>
                <div className="h-48 flex items-end gap-2">
                  {[45, 60, 35, 70, 55, 80].map((height, i) => (
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

              {/* Top Suppliers */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">En Aktif Tedarikçiler</h2>
                  <span className="text-xs text-muted-foreground">Bu ay</span>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "Atlas Tedarik A.Ş.", orders: 12, percent: 85 },
                    { name: "Yıldız Metal Ltd.", orders: 8, percent: 65 },
                    { name: "Delta Hammadde", orders: 6, percent: 42 },
                    { name: "Akdeniz Lojistik", orders: 5, percent: 31 },
                  ].map((supplier, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{supplier.name}</span>
                        <span className="text-muted-foreground text-xs">{supplier.orders} sipariş</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/30 rounded-full"
                          style={{ width: `${supplier.percent}%` }}
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
