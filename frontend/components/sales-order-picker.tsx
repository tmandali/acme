"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ChevronLeft, Search } from "lucide-react"

// Örnek Satış Siparişi Verileri
const salesOrders = [
  {
    id: "SO-2025-0042",
    customer: "Atlas Services",
    date: "09:34",
    subject: "Ofis Mobilyaları Siparişi",
    description: "Merhaba, 15 adet ofis sandalyesi ve 10 adet çalışma masası...",
    amount: "₺125.000",
    isNew: true,
  },
  {
    id: "SO-2025-0041",
    customer: "Yıldız Teknoloji",
    date: "Dün",
    subject: "Bilgisayar Donanımları",
    description: "50 adet laptop ve 50 adet monitör siparişimiz için...",
    amount: "₺450.000",
    isNew: true,
  },
  {
    id: "SO-2025-0040",
    customer: "Kuzey İnşaat",
    date: "2 gün önce",
    subject: "İnşaat Malzemeleri",
    description: "Şantiye için gerekli olan çimento, demir ve kum...",
    amount: "₺89.500",
    isNew: false,
  },
  {
    id: "SO-2025-0039",
    customer: "Deniz Lojistik",
    date: "2 gün önce",
    subject: "Depo Rafları",
    description: "Yeni depomuz için 200 adet raf sistemi siparişi...",
    amount: "₺67.800",
    isNew: false,
  },
  {
    id: "SO-2025-0038",
    customer: "Güneş Enerji",
    date: "1 hafta önce",
    subject: "Solar Panel Siparişi",
    description: "100 adet solar panel ve inverter sistemi için...",
    amount: "₺890.000",
    isNew: false,
  },
  {
    id: "SO-2025-0037",
    customer: "Akdeniz Gıda",
    date: "1 hafta önce",
    subject: "Soğutma Ekipmanları",
    description: "Endüstriyel soğutma sistemi ve depolama üniteleri...",
    amount: "₺234.500",
    isNew: false,
  },
]

// Komut tanımları
const commands = [
  { id: "today", label: "Bugünkü Siparişler", filter: (order: typeof salesOrders[0]) => order.date.includes("09:") || order.date.includes("10:") || order.date.includes("11:") || order.date.includes("12:") },
  { id: "yesterday", label: "Dünkü Siparişler", filter: (order: typeof salesOrders[0]) => order.date === "Dün" },
  { id: "week", label: "Bu Haftaki Siparişler", filter: (order: typeof salesOrders[0]) => !order.date.includes("hafta") },
  { id: "open", label: "Açık Siparişler", filter: (order: typeof salesOrders[0]) => order.isNew },
  { id: "high", label: "Yüksek Tutarlı (>100K)", filter: (order: typeof salesOrders[0]) => {
    const amount = parseInt(order.amount.replace(/[₺.]/g, "").replace(",", ""))
    return amount > 100000
  }},
]

export type SalesOrder = typeof salesOrders[0]

interface SalesOrderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect?: (order: SalesOrder) => void
}

export function SalesOrderPicker({ open, onOpenChange, onSelect }: SalesOrderPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeCommand, setActiveCommand] = useState<string | null>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)

  // "/" ile başlıyorsa komut modu
  const isCommandMode = searchQuery.startsWith("/")
  const commandQuery = isCommandMode ? searchQuery.slice(1).toLowerCase() : ""
  
  // Komut modunda filtrelenmiş komutlar
  const filteredCommands = isCommandMode 
    ? commands.filter(cmd => cmd.label.toLowerCase().includes(commandQuery))
    : []

  const filteredOrders = salesOrders.filter((order) => {
    // Aktif komut varsa ona göre filtrele
    if (activeCommand) {
      const cmd = commands.find(c => c.id === activeCommand)
      if (cmd && !cmd.filter(order)) return false
    }
    
    // Komut modundaysa siparişleri gösterme
    if (isCommandMode) return false
    
    // Normal arama
    if (!searchQuery) return true
    return (
      order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // Sheet açıldığında arama kutusuna odaklan
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
      setSelectedIndex(0)
      setActiveCommand(null)
      setSearchQuery("")
      return () => clearTimeout(timer)
    }
  }, [open])

  // Arama değiştiğinde seçimi sıfırla
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Sipariş seçme fonksiyonu
  const selectOrder = (order: SalesOrder) => {
    onSelect?.(order)
    onOpenChange(false)
  }

  // Komut seçme fonksiyonu
  const selectCommand = (commandId: string) => {
    setActiveCommand(commandId)
    setSearchQuery("")
    setSelectedIndex(0)
  }

  // Aktif komutu temizle
  const clearCommand = () => {
    setActiveCommand(null)
    setSearchQuery("")
  }

  // Klavye navigasyonu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCommandMode) {
      if (filteredCommands.length === 0) return
      
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => prev < filteredCommands.length - 1 ? prev + 1 : prev)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            selectCommand(filteredCommands[selectedIndex].id)
          }
          break
        case "Escape":
          e.preventDefault()
          setSearchQuery("")
          break
      }
      return
    }

    if (filteredOrders.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => prev < filteredOrders.length - 1 ? prev + 1 : prev)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOrders[selectedIndex]) {
          selectOrder(filteredOrders[selectedIndex])
        }
        break
      case "Backspace":
        if (searchQuery === "" && activeCommand) {
          e.preventDefault()
          clearCommand()
        }
        break
    }
  }

  // Sheet içinde yazmaya başlayınca arama kutusuna focus
  const handleSheetKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.target !== searchInputRef.current &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      searchInputRef.current?.focus()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col"
        onKeyDown={handleSheetKeyDown}
      >
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-lg font-medium flex items-center gap-2">
            {activeCommand && (
              <button onClick={clearCommand} className="-ml-1">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {activeCommand 
              ? commands.find(c => c.id === activeCommand)?.label 
              : "Satış Siparişleri"}
          </SheetTitle>
        </SheetHeader>

        {/* Arama Alanı */}
        <div className="p-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Aramak için yazın veya / ile filtrele..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 h-10 bg-muted/40 border-0 rounded-md"
            />
          </div>
        </div>

        {/* Komut Listesi veya Sipariş Listesi */}
        <div className="flex-1 overflow-auto border-t">
          {isCommandMode ? (
            <div className="divide-y">
              {filteredCommands.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <p className="text-sm">Komut bulunamadı</p>
                </div>
              ) : (
                filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => selectCommand(cmd.id)}
                    className={`w-full text-left p-4 border-l-4 ${
                      selectedIndex === index
                        ? "border-l-foreground bg-muted/80 pl-5"
                        : "border-l-transparent"
                    }`}
                  >
                    <span className="text-sm font-medium">{cmd.label}</span>
                  </button>
                ))
              )}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p className="text-sm">{activeCommand ? "Bu filtreye uygun sipariş bulunamadı" : "Sipariş bulunamadı"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredOrders.map((order, index) => (
                <button
                  key={order.id}
                  onClick={() => selectOrder(order)}
                  className={`w-full text-left p-4 border-l-4 ${
                    selectedIndex === index
                      ? "border-l-foreground bg-muted/80 pl-5"
                      : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{order.customer}</span>
                      {order.isNew && (
                        <span className="flex-shrink-0 w-2 h-2 bg-foreground rounded-full" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{order.date}</span>
                  </div>
                  <div className="text-sm font-medium mb-1 truncate">{order.subject}</div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{order.description}</p>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">{order.amount}</Badge>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">{order.id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

