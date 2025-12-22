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
  FileText,
  CreditCard,
  Clock,
  Building2,
  Calendar,
  Receipt,
  Plus,
  ChevronRight,
  BarChart3,
  Truck,
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

// Tedarikçi Borç Kartı
function SupplierDebtCard({
  supplier,
  totalDebt,
  dueDate,
  status,
  invoiceCount,
}: {
  supplier: string
  totalDebt: string
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
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{supplier}</p>
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
            <p className="text-xs text-muted-foreground">Toplam Borç</p>
            <p className="text-lg font-semibold tracking-tight">{totalDebt}</p>
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

// Yaklaşan Ödeme
function UpcomingPayment({
  supplier,
  amount,
  dueDate,
  daysLeft,
}: {
  supplier: string
  amount: string
  dueDate: string
  daysLeft: number
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${daysLeft <= 3 ? "bg-red-500" : daysLeft <= 7 ? "bg-amber-500" : "bg-emerald-500"}`} />
        <div>
          <p className="text-sm">{supplier}</p>
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

// Son Ödeme
function RecentPayment({
  supplier,
  amount,
  date,
  reference,
}: {
  supplier: string
  amount: string
  date: string
  reference: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
          <CreditCard className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="text-sm">{supplier}</p>
          <p className="text-xs text-muted-foreground">{reference}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-red-600">-{amount}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  )
}

export default function AccountsPayablePage() {
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
                  <BreadcrumbPage className="text-sm font-medium">Borç Hesapları</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Ödeme Yap
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Page Title */}
            <div className="mb-12">
              <h1 className="text-3xl font-light tracking-tight mb-1">
                Borç Hesapları
              </h1>
              <p className="text-muted-foreground">
                Tedarikçilere olan borçlarınızı takip edin ve ödeme süreçlerini yönetin
              </p>
            </div>

            {/* Stats */}
            <div className="border rounded-lg bg-card mb-12 grid grid-cols-1 md:grid-cols-4">
              <StatCard
                title="Toplam Borç"
                value="₺1,456,780"
                change="6.8%"
                changeType="up"
              />
              <StatCard
                title="Vadesi Geçen"
                value="₺187,250"
                change="12.4%"
                changeType="up"
                variant="danger"
              />
              <StatCard
                title="Bu Hafta Vadeli"
                value="₺124,680"
                change="3.9%"
                changeType="down"
                variant="warning"
              />
              <StatCard
                title="Aktif Tedarikçi"
                value="64"
                change="8.7%"
                changeType="up"
              />
            </div>

            {/* Quick Actions */}
            <div className="mb-12">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <a href="/accounts-payable/payment-entry" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Ödeme Girişi</span>
                </a>
                <a href="/accounts-payable/purchase-invoice" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Alış Faturası</span>
                </a>
                <a href="/accounts-payable/suppliers" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Tedarikçiler</span>
                </a>
                <a href="/accounts-payable/reports" className="p-4 border rounded-lg hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Borç Raporları</span>
                </a>
              </div>
            </div>

            {/* En Yüksek Borçlu Tedarikçiler */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">En Yüksek Borçlu Tedarikçiler</h2>
                <a href="/accounts-payable/all" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Tümünü Gör →
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SupplierDebtCard
                  supplier="Anadolu Tedarik A.Ş."
                  totalDebt="₺285,000"
                  dueDate="12 Ara 2024"
                  status="overdue"
                  invoiceCount={14}
                />
                <SupplierDebtCard
                  supplier="Marmara Lojistik Ltd."
                  totalDebt="₺198,750"
                  dueDate="22 Ara 2024"
                  status="due-soon"
                  invoiceCount={9}
                />
                <SupplierDebtCard
                  supplier="Ege Malzeme San."
                  totalDebt="₺167,500"
                  dueDate="26 Ara 2024"
                  status="due-soon"
                  invoiceCount={6}
                />
                <SupplierDebtCard
                  supplier="Karadeniz Hammadde"
                  totalDebt="₺134,800"
                  dueDate="03 Oca 2025"
                  status="normal"
                  invoiceCount={8}
                />
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Yaklaşan Ödemeler */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Yaklaşan Ödemeler</h2>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="divide-y">
                  <UpcomingPayment
                    supplier="Anadolu Tedarik A.Ş."
                    amount="₺55,000"
                    dueDate="22 Ara 2024"
                    daysLeft={2}
                  />
                  <UpcomingPayment
                    supplier="Marmara Lojistik Ltd."
                    amount="₺42,500"
                    dueDate="24 Ara 2024"
                    daysLeft={4}
                  />
                  <UpcomingPayment
                    supplier="İstanbul Ambalaj"
                    amount="₺28,750"
                    dueDate="27 Ara 2024"
                    daysLeft={7}
                  />
                  <UpcomingPayment
                    supplier="Ege Malzeme San."
                    amount="₺38,400"
                    dueDate="30 Ara 2024"
                    daysLeft={10}
                  />
                </div>
              </div>

              {/* Son Ödemeler */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Son Ödemeler</h2>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="divide-y">
                  <RecentPayment
                    supplier="Akdeniz Nakliyat"
                    amount="₺35,000"
                    date="19 Ara 2024"
                    reference="PAY-2024-0892"
                  />
                  <RecentPayment
                    supplier="Trakya Metal San."
                    amount="₺78,500"
                    date="18 Ara 2024"
                    reference="PAY-2024-0891"
                  />
                  <RecentPayment
                    supplier="Bursa Plastik Ltd."
                    amount="₺22,800"
                    date="17 Ara 2024"
                    reference="PAY-2024-0890"
                  />
                  <RecentPayment
                    supplier="Ankara Kimya A.Ş."
                    amount="₺44,200"
                    date="15 Ara 2024"
                    reference="PAY-2024-0889"
                  />
                </div>
              </div>
            </div>

            {/* Borç Yaşlandırma ve Grafik */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Borç Yaşlandırma */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Borç Yaşlandırma</h2>
                  <span className="text-xs text-muted-foreground">Güncel</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "0-30 Gün", amount: "₺587,200", percent: 40, color: "bg-emerald-500/50" },
                    { label: "31-60 Gün", amount: "₺423,830", percent: 29, color: "bg-blue-500/50" },
                    { label: "61-90 Gün", amount: "₺258,500", percent: 18, color: "bg-amber-500/50" },
                    { label: "90+ Gün", amount: "₺187,250", percent: 13, color: "bg-red-500/50" },
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

              {/* Aylık Ödeme Grafiği */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Aylık Ödemeler</h2>
                  <span className="text-xs text-muted-foreground">Son 6 ay</span>
                </div>
                <div className="h-48 flex items-end gap-2">
                  {[
                    { height: 55, label: "Tem", amount: "₺185K" },
                    { height: 70, label: "Ağu", amount: "₺235K" },
                    { height: 45, label: "Eyl", amount: "₺150K" },
                    { height: 85, label: "Eki", amount: "₺285K" },
                    { height: 60, label: "Kas", amount: "₺200K" },
                    { height: 75, label: "Ara", amount: "₺248K" },
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

            {/* Ödeme Performansı */}
            <div className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Ödeme Performansı</h2>
                <a href="/accounts-payable/reports" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Detaylı Rapor
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Zamanında Ödeme</span>
                    <span className="text-xs text-emerald-600">Bu ay</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">%78.2</p>
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: "78.2%" }} />
                  </div>
                </div>
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Ortalama Ödeme Süresi</span>
                    <span className="text-xs text-amber-600">Gün</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">38</p>
                  <p className="text-xs text-muted-foreground mt-2">Hedef: 30 gün</p>
                </div>
                <div className="p-5 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Bekleyen Fatura</span>
                    <span className="text-xs text-muted-foreground">Adet</span>
                  </div>
                  <p className="text-2xl font-light tracking-tight">186</p>
                  <p className="text-xs text-muted-foreground mt-2">₺1,456,780 toplam değer</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

