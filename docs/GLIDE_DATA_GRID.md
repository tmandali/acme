# Glide Data Grid Implementation

## Genel Bakış

SQL query sonuçları için @glideapps/glide-data-grid kütüphanesi başarıyla implement edildi. Bu kütüphane, Excel benzeri bir kullanıcı deneyimi sunar ve büyük veri setleri için optimize edilmiştir.

## Özellikler

### ✅ Temel Özellikler

- **Yüksek Performans**: Milyonlarca satır için optimize edilmiş virtualization
- **Excel Benzeri Deneyim**: Spreadsheet tarzı grid görünümü
- **Satır Numaraları**: Otomatik satır numaralandırma
- **Kolon Resize**: Sütun genişliklerini ayarlama
- **Smooth Scrolling**: Pürüzsüz kaydırma deneyimi
- **Tema Desteği**: Dark/Light mode otomatik entegrasyonu
- **CSV Export**: Sonuçları CSV olarak indirme
- **Tam Ekran Modu**: Sonuçları tam ekranda görüntüleme

### 🎨 Görsel Özellikler

- **Özel Tema**: Uygulamanın mevcut temasıyla uyumlu renkler
- **Tip Bazlı Hücreler**:
  - Text hücreleri
  - Number hücreleri (sağa hizalı)
  - Boolean hücreleri (checkbox)
  - NULL değerleri (gri, ortalanmış)
- **Özel Scrollbar**: Tema ile uyumlu scrollbar stilleri
- **Sticky Headers**: Kaydırma sırasında sabit başlıklar

### 📊 Veri Yönetimi

- **Streaming Support**: Gerçek zamanlı veri akışı desteği
- **Loading States**: Yükleme durumu göstergeleri
- **Error Handling**: Hata durumları için özel görünümler
- **Empty States**: Boş durum mesajları

## Kurulum

Gerekli paketler:

```bash
npm install @glideapps/glide-data-grid lodash react-responsive-carousel marked --legacy-peer-deps
```

## Kullanım

```tsx
import { ResultsTableGlide } from "./results-table-glide"

<ResultsTableGlide
  results={results}
  isLoading={isLoading}
  executionTime={executionTime}
  queryStatus={queryStatus}
  isFullscreen={isFullscreen}
  onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
/>
```

## Performans

- **Virtualization**: Sadece görünür satırlar render edilir
- **Memoization**: Gereksiz re-render'lar önlenir
- **Smooth Scrolling**: 60 FPS kaydırma performansı
- **Büyük Veri Setleri**: Milyonlarca satır sorunsuz çalışır

## Özelleştirme

### Tema Özelleştirme

Grid teması `customTheme` objesi ile özelleştirilebilir:

```tsx
const customTheme: Partial<Theme> = {
  accentColor: "#3b82f6",
  bgCell: "#0f172a",
  textDark: "#f1f5f9",
  // ... diğer özellikler
}
```

### CSS Özelleştirme

`globals.css` dosyasında `.glide-data-grid-custom` sınıfı ile özelleştirme yapılabilir.

## Klavye Kısayolları

- **Cmd/Ctrl + C**: Seçili hücreleri kopyala
- **Arrow Keys**: Hücreler arası gezinme
- **Shift + Arrow**: Çoklu hücre seçimi
- **Cmd/Ctrl + A**: Tüm hücreleri seç

## Bilinen Sınırlamalar

1. **React 19 Uyumluluğu**: `--legacy-peer-deps` ile kurulum gerekli
2. **Düzenleme Devre Dışı**: Grid sadece okuma modunda (read-only)
3. **Peer Dependencies**: lodash, marked ve react-responsive-carousel gerekli

## Gelecek Geliştirmeler

- [ ] Kolon filtreleme
- [ ] Kolon sıralama (şu an TanStack Table ile yapılıyor)
- [ ] Hücre düzenleme (opsiyonel)
- [ ] Kolon gizleme/gösterme
- [ ] Özel hücre renderlayıcıları
- [ ] Context menu (sağ tık menüsü)
- [ ] Clipboard işlemleri (kopyala/yapıştır)

## Dosya Yapısı

```
app/sql-query/components/
├── results-table-glide.tsx    # Ana Glide Data Grid komponenti
├── results-table.tsx           # Eski virtualization implementasyonu (yedek)
├── results-table-types.tsx     # Tip tanımları
└── results-table-utils.tsx     # Yardımcı fonksiyonlar

app/
└── globals.css                 # Glide Data Grid özel stilleri
```

## Sorun Giderme

### Build Hatası: "Module not found: Can't resolve 'lodash/clamp.js'"

**Çözüm**: Eksik bağımlılıkları yükleyin:

```bash
npm install lodash react-responsive-carousel marked --legacy-peer-deps
```

### Grid Görünmüyor

**Çözüm**:

1. CSS import'unun doğru olduğundan emin olun
2. Parent container'ın height değeri olduğundan emin olun
3. `results.length > 0` kontrolünü yapın

### Tema Çalışmıyor

**Çözüm**: `useTheme` hook'unun `next-themes` paketinden geldiğinden emin olun.

## Referanslar

- [Glide Data Grid Dokümantasyonu](https://github.com/glideapps/glide-data-grid)
- [Glide Data Grid Storybook](https://glideapps.github.io/glide-data-grid/)
