import type { Variable } from "./types"
import { 
  Key, Link2, ToggleLeft, Clock, FileJson, FileText, Circle,
  Type, Hash, Calendar, ListFilter, ChevronDown, TextCursorInput, ArrowLeftRight
} from "lucide-react"

// Helper: Parse default value (can be JSON array or single value)
export function parseDefaultValues(value: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
    return [value]
  } catch {
    return value ? [value] : []
  }
}

// Helper: Stringify default values
export function stringifyDefaultValues(values: string[]): string {
  if (values.length === 0) return ""
  if (values.length === 1) return values[0]
  return JSON.stringify(values)
}

// Kolon tipi için renk ve ikon
export const columnTypeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  BigInteger: { icon: Key, color: "text-amber-500" },
  Integer: { icon: Hash, color: "text-amber-500" },
  String: { icon: Type, color: "text-blue-500" },
  Text: { icon: FileText, color: "text-blue-500" },
  Boolean: { icon: ToggleLeft, color: "text-purple-500" },
  DateTime: { icon: Clock, color: "text-emerald-500" },
  Date: { icon: Calendar, color: "text-emerald-500" },
  Decimal: { icon: Hash, color: "text-orange-500" },
  JSON: { icon: FileJson, color: "text-cyan-500" },
}

// Değişken tipi için ikon
export const variableTypeConfig: Record<Variable["type"], { icon: React.ElementType; label: string; color: string }> = {
  text: { icon: Type, label: "Metin", color: "text-blue-500" },
  number: { icon: Hash, label: "Sayı", color: "text-amber-500" },
  date: { icon: Calendar, label: "Tarih", color: "text-emerald-500" },
  select: { icon: ListFilter, label: "Seçim", color: "text-purple-500" },
}

// Filtre tipi config
export const filterTypeConfig: Record<Variable["filterType"], { icon: React.ElementType; label: string; description: string }> = {
  dropdown: { icon: ChevronDown, label: "Açılır liste", description: "Önceden tanımlanmış seçeneklerden seç" },
  input: { icon: TextCursorInput, label: "Girdi kutusu", description: "Serbest metin girişi" },
  switch: { icon: ToggleLeft, label: "Açık/Kapalı", description: "İki durumlu toggle switch" },
  between: { icon: ArrowLeftRight, label: "Aralık", description: "Başlangıç ve bitiş değeri arasında filtrele" },
}

// Kolon ikon helper
export function getColumnIcon(type: string, hasFk?: boolean) {
  if (hasFk) return { icon: Link2, color: "text-rose-500" }
  return columnTypeConfig[type] || { icon: Circle, color: "text-muted-foreground" }
}

// Label'dan name oluştur (uppercase, özel karakterleri _ ile değiştir)
export function generateNameFromLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')  // Harf ve rakam dışındakileri _ yap
    .replace(/_+/g, '_')         // Birden fazla _ varsa tek _ yap
    .replace(/^_|_$/g, '')       // Baş ve sondaki _ kaldır
    || 'KRITER'                   // Boşsa varsayılan
}

