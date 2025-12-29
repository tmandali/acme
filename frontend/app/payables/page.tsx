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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
  Wallet,
  Clock,
  Users,
  Calendar,
  Receipt,
  Plus,
  ChevronRight,
  Send,
  BarChart3,
} from "lucide-react"

// Stat Card
function StatCard({
  title,
  value,
  change,
  changeType,
  variant = "default",
}: {
  title: string
  value: string
  change: string
  changeType: "up" | "down"
  variant?: "default" | "warning" | "danger"
}) {
  const variantStyles = {
    default: "",
    warning: "bg-amber-500/5 border-amber-500/20",
    danger: "bg-red-500/5 border-red-500/20",
  }

  return (
    <div className={`p-6 border-b md:border-b-0 md:border-r last:border-r-0 last:border-b-0 ${variantStyles[variant]}`}>
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

// Müşteri Alacak Kartı
function CustomerReceivableCard({
  customer,
  totalReceivable,
  dueDate,
  status,
  invoiceCount,
}: {
  customer: string
  totalReceivable: string
  dueDate: string
  status: "overdue" | "due-soon" | "normal"
  invoiceCount: number
}) {
  const statusConfig = {
    overdue: {
      badge: "Vadesi Geçti",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    "due-soon": {
      badge: "Yaklaşıyor",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    normal: {
      badge: "Normal",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
  }

  return (
    <div className="p-4 border rounded-lg hover:bg-muted/30 transition-colors group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{customer}</p>
            <p className="text-xs text-muted-foreground">{invoiceCount} fatura</p>
          </div>
        </div>
        <Badge variant="outline" className={statusConfig[status].className}>
          {statusConfig[status].badge}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Toplam Alacak</p>
            <p className="text-lg font-semibold tracking-tight">{totalReceivable}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vade Tarihi</p>
            <p className="text-sm">{dueDate}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}

// Yaklaşan Tahsilat
function UpcomingCollection({
  customer,
  amount,
  dueDate,
  daysLeft,
}: {
  customer: string
  amount: string
  dueDate: string
  daysLeft: number
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${daysLeft <= 3 ? "bg-red-500" : daysLeft <= 7 ? "bg-amber-500" : "bg-emerald-500"}`} />
        <div>
          <p className="text-sm">{customer}</p>
          <p className="text-xs text-muted-foreground">{dueDate}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{amount}</p>
        <p className="text-xs text-muted-foreground">{daysLeft} gün kaldı</p>
      </div>
    </div>
  )
}

// Son Tahsilat
function RecentCollection({
  customer,
  amount,
  date,
  reference,
}: {
  customer: string
  amount: string
  date: string
  reference: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Wallet className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm">{customer}</p>
          <p className="text-xs text-muted-foreground">{reference}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-emerald-600">+{amount}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  )
}

export default function ReceivablesPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">Alacak Hesapları</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Tahsilat Ekle
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Page Title */}
            <div className="mb-12">
              <h1 className="text-3xl font-light tracking-tight mb-1">
                Alacak Hesapları
              </h1>
              <p className="text-muted-foreground">
                Müşterilerden alacaklarınızı takip edin ve tahsilat süreçlerini yönetin
              </p>
            </div>

            {/* Stats */}
            <div className="border rounded-lg bg-card mb-12 grid grid-cols-1 md:grid-cols-4">
              <StatCard
                title="Toplam Alacak"
                value="₺2,847,650"
                change="12.5%"
                changeType="up"
              />
              <StatCard
                title="Vadesi Geçen"
                value="₺342,800"
                change="8.7%"
                changeType="up"
                variant="danger"
              />
              <StatCard
                title="Bu Hafta Vadeli"
                value="₺156,420"
                change="5.2%"
                changeType="down"
                variant="warning"
              />
              <StatCard
                title="Aktif Müşteri"
                value="128"
                change="15.3%"
                changeType="up"
              />
            </div>

            {/* Quick Actions */}
            <div className="mb-12">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <a href="/receivables/collection-entry" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Tahsilat Girişi</span>
                </a>
                <a href="/sales-invoice/new" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Yeni Satış Faturası</span>
                </a>
                <a href="/receivables/customers" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Müşteriler</span>
                </a>
                <a href="/receivables/send-reminder" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Send className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Hatırlatma Gönder</span>
                </a>
              </div>
            </div>

            {/* En Yüksek Alacaklı Müşteriler */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">En Yüksek Alacaklı Müşteriler</h2>
                <a href="/receivables/all" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Tümünü Gör →
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CustomerReceivableCard
                  customer="Yıldız Holding A.Ş."
                  totalReceivable="₺485,000"
                  dueDate="10 Ara 2024"
                  status="overdue"
                  invoiceCount={15}
                />
                <CustomerReceivableCard
                  customer="Atlas Teknoloji Ltd."
                  totalReceivable="₺324,750"
                  dueDate="22 Ara 2024"
                  status="due-soon"
                  invoiceCount={9}
                />
                <CustomerReceivableCard
                  customer="Deniz İnşaat San."
                  totalReceivable="₺278,500"
                  dueDate="28 Ara 2024"
                  status="due-soon"
                  invoiceCount={7}
                />
                <CustomerReceivableCard
                  customer="Boğaziçi Ticaret A.Ş."
                  totalReceivable="₺198,400"
                  dueDate="05 Oca 2025"
                  status="normal"
                  invoiceCount={6}
                />
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Yaklaşan Tahsilatlar */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Yaklaşan Tahsilatlar</h2>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="divide-y">
                  <UpcomingCollection
                    customer="Yıldız Holding A.Ş."
                    amount="₺85,000"
                    dueDate="22 Ara 2024"
                    daysLeft={2}
                  />
                  <UpcomingCollection
                    customer="Atlas Teknoloji Ltd."
                    amount="₺62,500"
                    dueDate="24 Ara 2024"
                    daysLeft={4}
                  />
                  <UpcomingCollection
                    customer="Marmara Gıda"
                    amount="₺38,750"
                    dueDate="27 Ara 2024"
                    daysLeft={7}
                  />
                  <UpcomingCollection
                    customer="Deniz İnşaat San."
                    amount="₺54,200"
                    dueDate="30 Ara 2024"
                    daysLeft={10}
                  />
                </div>
              </div>

              {/* Son Tahsilatlar */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Son Tahsilatlar</h2>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="divide-y">
                  <RecentCollection
                    customer="Ege Tekstil A.Ş."
                    amount="₺45,000"
                    date="19 Ara 2024"
                    reference="REC-2024-1247"
                  />
                  <RecentCollection
                    customer="Akdeniz Gıda Ltd."
                    amount="₺87,500"
                    date="18 Ara 2024"
                    reference="REC-2024-1246"
                  />
                  <RecentCollection
                    customer="Karadeniz Otomotiv"
                    amount="₺32,800"
                    date="17 Ara 2024"
                    reference="REC-2024-1245"
                  />
                  <RecentCollection
                    customer="İç Anadolu Makine"
                    amount="₺56,200"
                    date="15 Ara 2024"
                    reference="REC-2024-1244"
                  />
                </div>
              </div>
            </div>

            {/* Alacak Yaşlandırma ve Grafik */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Alacak Yaşlandırma */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Alacak Yaşlandırma</h2>
                  <span className="text-xs text-muted-foreground">Güncel</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "0-30 Gün", amount: "₺1,245,800", percent: 44, color: "bg-emerald-500/50" },
                    { label: "31-60 Gün", amount: "₺756,420", percent: 27, color: "bg-blue-500/50" },
                    { label: "61-90 Gün", amount: "₺502,630", percent: 18, color: "bg-amber-500/50" },
                    { label: "90+ Gün", amount: "₺342,800", percent: 12, color: "bg-red-500/50" },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">{item.amount}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aylık Tahsilat Grafiği */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Aylık Tahsilatlar</h2>
                  <span className="text-xs text-muted-foreground">Son 6 ay</span>
                </div>
                <div className="h-48 flex items-end gap-2">
                  {[
                    { height: 60, label: "Tem", amount: "₺285K" },
                    { height: 75, label: "Ağu", amount: "₺356K" },
                    { height: 50, label: "Eyl", amount: "₺238K" },
                    { height: 90, label: "Eki", amount: "₺428K" },
                    { height: 65, label: "Kas", amount: "₺312K" },
                    { height: 80, label: "Ara", amount: "₺385K" },
                  ].map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.amount}
                      </span>
                      <div
                        className="w-full bg-foreground/10 hover:bg-foreground/20 transition-colors rounded"
                        style={{ height: `${item.height}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tahsilat Durumu Özeti */}
            <div className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Tahsilat Performansı</h2>
                <a href="/receivables/reports" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Detaylı Rapor
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Tahsilat Oranı</span>
                    <span className="text-xs text-emerald-600">Bu ay</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">%87.4</p>
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: "87.4%" }} />
                  </div>
                </div>
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Ortalama Tahsilat Süresi</span>
                    <span className="text-xs text-amber-600">Gün</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">32</p>
                  <p className="text-xs text-muted-foreground mt-2">Hedef: 30 gün</p>
                </div>
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Bekleyen Fatura</span>
                    <span className="text-xs text-muted-foreground">Adet</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">247</p>
                  <p className="text-xs text-muted-foreground mt-2">₺2,847,650 toplam değer</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
