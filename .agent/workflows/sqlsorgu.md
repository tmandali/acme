---
description: SQL Sorgu Ekranı UI ve Mimarisi Hakkında Bağlam
---
# SQL Sorgu Ekranı UI Dokümantasyonu

Bu doküman, `app/sql-query` modülündeki SQL sorgu ekranının mevcut UI yapısını, bileşen hiyerarşisini ve tasarım sistemini açıklar. Tasarım değişiklikleri istendiğinde referans olarak kullanılmalıdır.

## 1. Genel Yerleşim (Layout)
Sayfa, `SidebarProvider` içerisinde `SidebarInset` bileşenini kullanır.
Ana yapı dikey olarak üçe bölünmüştür:
1.  **Header**: Sabit üst bar.
2.  **Main Content**: Editör ve sonuç tablosu.
3.  **Side Panel (Opsiyonel)**: Sağ tarafta açılan Şema veya Kriterler paneli.

Dosya Yolu: `app/sql-query/page.tsx`

### Header (`<header>`)
*   **Yükseklik**: `h-14` (56px)
*   **İçerik**:
    *   **Sol**: Sidebar tetikleyici, Breadcrumb, Sorgu Adı (edit edilebilir input).
    *   **Sağ**: Dosya Aç (YAML), Kaydet (YAML) butonları.
*   **Stil**: `sticky top-0 z-10 border-b bg-background`.

## 2. Ana Bileşenler

### A. SQL Editör Alanı (Sol/Orta Panel)
Kullanıcı `isResultsFullscreen` olmadığında görünür.
*   **Database Selector**: Üstte, veritabanı seçimi (şimdilik "Sample Database") ve sağ panel toggle butonları (Şema / Kriterler).
*   **SQLEditor**: `react-ace` tabanlı kod editörü.
    *   **Konum**: `relative` pozisyonlandırma.
    *   **Yükseklik**: Kullanıcı tarafından yeniden boyutlandırılabilir (`editorHeight` state).
    *   **Özellikler**:
        *   `Run` butonu sağ altta sabit (`absolute right-4 bottom-4`).
        *   Alt kısımda resize handle (`cursor-row-resize`).

Dosya Yolu: `app/sql-query/components/sql-editor.tsx`

### B. Sonuç Tablosu (ResultsTable)
Editörün altında yer alır (editör gizlendiğinde tüm alanı kaplar).
*   **Header**: Sonuç sayısı, süre ve aksiyon butonları (Kopyala, İndir, Tam Ekran).
*   **Tablo**:
    *   `sticky top-0` header.
    *   Tailwind `border-collapse` ve `text-xs`.
    *   Loading durumunda spinner.
    *   Boş durumda veya iptal durumunda ikonlu mesajlar.

Dosya Yolu: `app/sql-query/components/results-table.tsx`

### C. Yan Paneller (Sağ Panel)
Ekranın sağında, yeniden boyutlandırılabilir panel.
*   **Genişlik**: `sidePanelWidth` (default 320px).
*   **Yapı**: Sol kenarında resize handle (`cursor-col-resize`) bulunur.
*   **İki Mod**:
    1.  **SchemaPanel**: Veritabanı tablolarını ve kolonlarını listeler (`accordion` yapısı). Tabloya tıklayınca editöre sorgu ekler.
    2.  **VariablesPanel**: Sorgudaki `{{variable}}` parametrelerini yönetir.

Dosya Yolu: `app/sql-query/page.tsx` (Panel container), `components/schema-panel.tsx`, `components/variables-panel.tsx`

## 3. Tasarım Sistemi ve Renkler
*   **Kütüphane**: `shadcn/ui` (Radix UI tabanlı) + Tailwind CSS.
*   **Renkler**:
    *   `bg-muted/30`: Alt başlıklar ve hafif ayırıcılar için.
    *   `border-b`: Genel ayırıcılar.
    *   `text-muted-foreground`: İkincil metinler.
*   **İkonlar**: `lucide-react`.

## 4. Özellikler ve Davranışlar
*   **Jinja Template**: `{{variable}}` formatındaki değişkenleri otomatik tanır ve input oluşturur.
*   **Kısayollar**: `Cmd+Enter` (Çalıştır), `Esc` (Tam ekrandan çık).
*   **Durum Yönetimi**: `query`, `results`, `variables` React state ile yönetilir. YAML dosyasına import/export mevcuttur.

## 5. Kritik Stil Sınıfları
*   **Panel Resize**: `cursor-row-resize` (Dikey), `cursor-col-resize` (Yatay).
*   **Sticky Header**: Tablo başlıkları ve sayfa başlığı için `sticky top-0`.
*   **Flex Düzeni**: Ana kapsayıcı `flex flex-col h-svh overflow-hidden` yapısındadır, içerik taşmaları `flex-1 overflow-hidden` ile yönetilir.
