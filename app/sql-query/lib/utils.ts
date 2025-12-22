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

// Jinja template işleme fonksiyonu
export function processJinjaTemplate(sqlQuery: string, variables: Variable[]): { processedQuery: string; replacements: Record<string, string>; missingVariables: { name: string; label: string; required: boolean }[] } {
  const replacements: Record<string, string> = {}
  const missingVariables: { name: string; label: string; required: boolean }[] = []

  // {{VARIABLE_NAME}} veya {{VARIABLE_NAME:SUFFIX}} pattern'ini bul ve değiştir
  const templatePattern = /\{\{(\w+)(?::(BEGIN|END))?\}\}/g

  const processedQuery = sqlQuery.replace(templatePattern, (match, varName, suffix) => {
    // Variable'lardan değeri bul - sadece name ile eşleştir
    const variable = variables.find(v => v.name === varName)

    // Aktif değeri al (value boşsa defaultValue'yu kullan)
    const activeValue = variable?.value || variable?.defaultValue

    if (variable && activeValue) {
      let replacement: string

      // Switch filtre yöntemi için değeri olduğu gibi kullan (tırnaksız)
      if (variable.filterType === "switch") {
        replacement = activeValue
        replacements[match] = replacement
        return replacement
      }

      // Between (Aralık) filtre yöntemi için özel işlem
      if (variable.filterType === "between") {
        try {
          // Değer çözümleme önceliği:
          // 1. variable.value (aktif değer)
          // 2. variable.defaultValue (varsayılan değer)
          // 3. variable.betweenStart/End (ayrı alanlar)

          let range: { start: string, end: string } = { start: "", end: "" }

          // 1. Aktif değeri dene
          if (variable.value) {
            try {
              range = JSON.parse(variable.value)
            } catch (e) {
              // Parse hatası, devam et
            }
          }

          // 2. Varsayılan değeri dene (eğer start/end boşsa)
          if ((!range.start || !range.end) && variable.defaultValue) {
            try {
              const defaultRange = JSON.parse(variable.defaultValue)
              range = {
                start: range.start || defaultRange.start,
                end: range.end || defaultRange.end
              }
            } catch (e) {
              // Parse hatası, devam et
            }
          }

          // 3. Ayrı alanları dene (fallback)
          if (!range.start) range.start = variable.betweenStart || ""
          if (!range.end) range.end = variable.betweenEnd || ""

          const start = range.start
          const end = range.end

          if (start && end) {
            // Suffix varsa sadece ilgili değeri döndür
            if (suffix === "BEGIN") {
              replacement = variable.type === "number" ? start : `'${start}'`
            } else if (suffix === "END") {
              replacement = variable.type === "number" ? end : `'${end}'`
            } else {
              // Suffix yoksa BETWEEN clause oluştur
              replacement = variable.type === "number"
                ? `${start} AND ${end}`
                : `'${start}' AND '${end}'`
            }

            replacements[match] = replacement
            return replacement
          }
        } catch (e) {
          console.error("Between değeri parse edilemedi:", activeValue)
        }
      }

      // Çoklu değer için array olabilir
      const values = parseDefaultValues(activeValue)

      if (values.length > 1) {
        // Çoklu değer: IN clause için format
        if (variable.type === "number") {
          replacement = `(${values.join(", ")})`
        } else {
          replacement = `('${values.join("', '")}')`
        }
      } else if (values.length === 1) {
        // Tek değer
        if (variable.type === "number") {
          replacement = values[0]
        } else {
          replacement = `'${values[0]}'`
        }
      } else {
        // Değer boş - eksik değişken olarak işaretle
        missingVariables.push({ name: varName, label: variable.label, required: variable.required })
        return "" // Boş değer için boş string kullan
      }

      replacements[match] = replacement
      return replacement
    }

    // Variable tanımlı ama değeri yok
    if (variable) {
      missingVariables.push({ name: varName, label: variable.label, required: variable.required })
      return "" // Değer yoksa boş string kullan
    }

    // Variable hiç tanımlı değil - boş string kullan
    missingVariables.push({ name: varName, label: varName, required: false })
    return ""
  })

  return { processedQuery, replacements, missingVariables }
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

