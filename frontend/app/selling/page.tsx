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
  Receipt,
  CreditCard,
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

export default function SellingPage() {
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
                  <BreadcrumbPage className="text-sm font-medium">Satış</BreadcrumbPage>
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
                Satış
              </h1>
              <p className="text-muted-foreground">
                Satış siparişleri ve müşteri işlemlerini yönetin
              </p>
            </div>

            {/* Stats */}
            <div className="border rounded-lg bg-card mb-12 grid grid-cols-1 md:grid-cols-4">
              <StatCard
                title="Toplam Satış"
                value="₺847,250"
                change="12.5%"
                changeType="up"
              />
              <StatCard
                title="Açık Siparişler"
                value="34"
                change="8.2%"
                changeType="up"
              />
              <StatCard
                title="Bekleyen Tahsilat"
                value="₺198,400"
                change="3.7%"
                changeType="down"
              />
              <StatCard
                title="Aktif Müşteriler"
                value="156"
                change="15.3%"
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
                    title="Satış Siparişi Oluştur"
                    icon={ClipboardList}
                    href="/selling/sales-order/new"
                  />
                  <QuickAction
                    title="Müşteri Ekle"
                    icon={Users}
                    href="/selling/customer/new"
                  />
                  <QuickAction
                    title="Sevkiyat Girişi"
                    icon={Package}
                    href="/selling/delivery-note/new"
                  />
                  <QuickAction
                    title="Satış Faturası Oluştur"
                    icon={Receipt}
                    href="/accounting/sales-invoice/new"
                  />
                  <QuickAction
                    title="Teklif Oluştur"
                    icon={FileText}
                    href="/selling/quotation/new"
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Son Siparişler</h2>
                <div className="divide-y">
                  <ActivityItem
                    title="SO-2024-0892"
                    description="Yıldız Holding A.Ş. - ₺45,200"
                    time="5dk"
                  />
                  <ActivityItem
                    title="SO-2024-0891"
                    description="Atlas Ticaret Ltd. - ₺28,750"
                    time="32dk"
                  />
                  <ActivityItem
                    title="SO-2024-0890"
                    description="Deniz İnşaat A.Ş. - ₺67,300"
                    time="2sa"
                  />
                  <ActivityItem
                    title="SO-2024-0889"
                    description="Güneş Elektronik - ₺12,400"
                    time="4sa"
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
                    title="Müşteriler"
                    icon={Building2}
                    href="/selling/customer"
                  />
                  <QuickAction
                    title="Müşteri Grupları"
                    icon={Users}
                    href="/selling/customer-group"
                  />
                  <QuickAction
                    title="Adresler"
                    icon={MapPin}
                    href="/selling/address"
                  />
                  <QuickAction
                    title="Ürün Kategorileri"
                    icon={Tags}
                    href="/selling/item-group"
                  />
                  <QuickAction
                    title="Ödeme Koşulları"
                    icon={Wallet}
                    href="/selling/payment-terms"
                  />
                  <QuickAction
                    title="Fiyat Listeleri"
                    icon={CreditCard}
                    href="/selling/price-list"
                  />
                </div>
              </div>

              {/* Reports */}
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Raporlar</h2>
                <div className="divide-y">
                  <QuickAction
                    title="Satış Analizi"
                    icon={BarChart3}
                    href="/selling/reports/sales-analytics"
                  />
                  <QuickAction
                    title="Müşteri Performansı"
                    icon={LineChart}
                    href="/selling/reports/customer-performance"
                  />
                  <QuickAction
                    title="Ürün Bazlı Satış"
                    icon={PieChart}
                    href="/selling/reports/product-sales"
                  />
                  <QuickAction
                    title="Sipariş Özeti"
                    icon={FileBarChart}
                    href="/selling/reports/order-summary"
                  />
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Sales Chart */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Satış Grafiği</h2>
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

              {/* Top Customers */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">En Aktif Müşteriler</h2>
                  <span className="text-xs text-muted-foreground">Bu ay</span>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "Yıldız Holding A.Ş.", orders: 18, percent: 90 },
                    { name: "Atlas Ticaret Ltd.", orders: 14, percent: 70 },
                    { name: "Deniz İnşaat A.Ş.", orders: 9, percent: 45 },
                    { name: "Güneş Elektronik", orders: 7, percent: 35 },
                  ].map((customer, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{customer.name}</span>
                        <span className="text-muted-foreground text-xs">{customer.orders} sipariş</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/30 rounded-full"
                          style={{ width: `${customer.percent}%` }}
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

