"use client"

import { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { SalesOrderPicker, SalesOrder } from "@/components/sales-order-picker"
import { Save, Plus, Printer, MoreHorizontal, ChevronDown, Clock, Eye, Download, User } from "lucide-react"

export default function NewSalesInvoicePage() {
  const [activeTab, setActiveTab] = useState("details")
  const [dimensionsOpen, setDimensionsOpen] = useState(false)
  const [salesOrderSheetOpen, setSalesOrderSheetOpen] = useState(false)

  const handleOrderSelect = (order: SalesOrder) => {
    console.log("Seçilen sipariş:", order.id)
    // Burada sipariş kalemlerini faturaya ekleyebilirsiniz
  }
  
  const tabs = [
    { id: "details", label: "Detaylar" },
    { id: "payments", label: "Ödemeler" },
    { id: "address", label: "Adres & İletişim" },
    { id: "terms", label: "Şartlar" },
    { id: "more-info", label: "Daha Fazla Bilgi" },
    { id: "connections", label: "Bağlantılar" },
  ]

  return (
    <SidebarProvider defaultOpen={false}>
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
                  <BreadcrumbLink href="/accounting" className="text-muted-foreground hover:text-foreground text-sm">
                    Muhasebe
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/accounting/sales-invoice" className="text-muted-foreground hover:text-foreground text-sm">
                    Satış Faturası
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">Yeni</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Zaman Çizelgesi Getir */}
            <Button variant="ghost" size="sm" className="h-8">
              <Clock className="h-4 w-4 mr-2" />
              Zaman Çizelgesi Getir
            </Button>

            {/* Oluştur Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  Oluştur
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Abonelik</DropdownMenuItem>
                <DropdownMenuItem>Ödeme Talebi</DropdownMenuItem>
                <DropdownMenuItem>Ödeme Kaydı</DropdownMenuItem>
                <DropdownMenuItem>Kalite Denetimi</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Önizleme Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Eye className="h-4 w-4 mr-2" />
                  Önizleme
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Standart</DropdownMenuItem>
                <DropdownMenuItem>Vergi Faturası</DropdownMenuItem>
                <DropdownMenuItem>Detaylı</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Kalem Al Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Download className="h-4 w-4 mr-2" />
                  Kalem Al
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSalesOrderSheetOpen(true)}>Satış Siparişi</DropdownMenuItem>
                <DropdownMenuItem>İrsaliye</DropdownMenuItem>
                <DropdownMenuItem>Teklif</DropdownMenuItem>
                <DropdownMenuItem>Zaman Çizelgesi</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Print */}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Printer className="h-4 w-4" />
            </Button>

            {/* Daha Fazla Seçenek */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Kopyala</DropdownMenuItem>
                <DropdownMenuItem>Yeniden Adlandır</DropdownMenuItem>
                <DropdownMenuItem>Yenile</DropdownMenuItem>
                <DropdownMenuItem>Panoya Kopyala</DropdownMenuItem>
                <DropdownMenuItem>Bağlantılar</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Sil</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Kaydet Butonu */}
            <Button size="sm" className="h-8 ml-1">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Kaydet
            </Button>
          </div>
        </header>

        {/* Main Content - Kaydırılabilir */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-12">
            {/* Sayfa Başlığı */}
            <div className="mb-10">
              <h1 className="text-3xl font-light tracking-tight mb-2">Yeni Satış Faturası</h1>
              <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                Kaydedilmedi
              </Badge>
            </div>

            {/* Form */}
            <div className="space-y-8">
              {/* Tabs */}
              <div className="border-b">
                <nav className="flex gap-8 -mb-px">
                  {tabs.map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-3 text-sm font-medium transition-colors ${
                        activeTab === tab.id 
                          ? "border-b-2 border-foreground text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Form Alanları - 3 Sütunlu Düzen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6">
                {/* Sol Sütun - Müşteri Bilgileri */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Müşteri
                    </Label>
                    <div className="flex items-center gap-3 h-10 px-3 bg-muted/40 rounded-md">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Atlas Services</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Müşteri Adı (Arapça)
                    </Label>
                    <Input 
                      className="h-10 rounded-md bg-muted/40 border-0"
                      placeholder=""
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Vergi No
                    </Label>
                    <Input 
                      className="h-10 rounded-md bg-muted/40 border-0"
                      placeholder=""
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Şirket <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      defaultValue="Spindl" 
                      className="h-10 rounded-md bg-muted/40 border-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Şirket Vergi No
                    </Label>
                    <Input 
                      className="h-10 rounded-md bg-muted/40 border-0"
                      placeholder=""
                    />
                  </div>
                </div>

                {/* Orta Sütun - Tarih Bilgileri */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Tarih <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      type="text" 
                      defaultValue="01-01-2025" 
                      className="h-10 rounded-md bg-muted/40 border-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Kayıt Saati
                    </Label>
                    <Input 
                      type="text" 
                      defaultValue="12:56:29" 
                      className="h-10 rounded-md bg-muted/40 border-0"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="edit-posting" className="rounded-sm" />
                    <Label htmlFor="edit-posting" className="text-sm font-medium cursor-pointer">
                      Tarih ve Saati Düzenle
                    </Label>
                  </div>

                  <div className="space-y-2 pt-4">
                    <Label className="text-sm text-muted-foreground">
                      Ödeme Vadesi <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      type="text" 
                      defaultValue="01-01-2025"
                      className="h-10 rounded-md bg-muted/40 border-0"
                    />
                  </div>
                </div>

                {/* Sağ Sütun - Onay Kutuları */}
                <div className="space-y-5">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-payment" className="rounded-sm" />
                    <Label htmlFor="include-payment" className="text-sm font-medium cursor-pointer">
                      Ödeme Dahil Et (POS)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="is-return" className="rounded-sm" />
                    <Label htmlFor="is-return" className="text-sm font-medium cursor-pointer">
                      İade (Alacak Dekontu)
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="is-debit-note" className="rounded-sm" />
                      <Label htmlFor="is-debit-note" className="text-sm font-medium cursor-pointer">
                        Fiyat Düzeltme Kaydı (Borç Dekontu)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Mevcut bir Satış Faturasına karşı 0 miktarlı borç dekontu oluştur
                    </p>
                  </div>
                </div>
              </div>

              {/* Muhasebe Boyutları Bölümü */}
              <div className="border-t pt-6">
                <button 
                  onClick={() => setDimensionsOpen(!dimensionsOpen)}
                  className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${dimensionsOpen ? "rotate-0" : "-rotate-90"}`} />
                  Muhasebe Boyutları
                </button>
                
                {dimensionsOpen && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Maliyet Merkezi
                      </Label>
                      <Select>
                        <SelectTrigger className="h-10 rounded-md bg-muted/40 border-0">
                          <SelectValue placeholder="Maliyet merkezi seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Ana</SelectItem>
                          <SelectItem value="branch">Şube</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Proje
                      </Label>
                      <Select>
                        <SelectTrigger className="h-10 rounded-md bg-muted/40 border-0">
                          <SelectValue placeholder="Proje seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project-a">Proje A</SelectItem>
                          <SelectItem value="project-b">Proje B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Fatura Kalemleri</h2>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Kalem Ekle
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 font-medium">Ürün/Hizmet</th>
                        <th className="text-left text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 font-medium">Miktar</th>
                        <th className="text-left text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 font-medium">Birim Fiyat</th>
                        <th className="text-left text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 font-medium">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                          Henüz kalem eklenmedi
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>

      <SalesOrderPicker
        open={salesOrderSheetOpen}
        onOpenChange={setSalesOrderSheetOpen}
        onSelect={handleOrderSelect}
      />
    </SidebarProvider>
  )
}
