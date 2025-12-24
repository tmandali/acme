// Variable/Kriter tipi
export interface Variable {
  id: string
  name: string
  type: "text" | "number" | "date" | "select"
  label: string
  filterType: "dropdown" | "input" | "between"
  multiSelect: boolean
  defaultValue: string // Varsayılan değer (düzenleme modunda ayarlanır)
  value: string // Aktif değer (değer giriş modunda kullanılır, SQL'e bu gönderilir)
  required: boolean
  valuesSource: "model" | "custom"
  customValues: string
  regexPattern?: string // Regex pattern for text validation
  regexErrorMessage?: string // Custom error message for regex validation
  betweenStart?: string // Between filter start value
  betweenEnd?: string // Between filter end value
  emptyValue?: string // SQL to use when value is empty (e.g., '1=1' or 'IS NULL')
}

// YAML dosya yapısı
export interface QueryFile {
  name: string
  sql: string
  variables: Variable[]
  connectionId?: string
}

// Şema Tipleri
export interface Column {
  name: string
  type: string
  fk?: string
}

export interface Table {
  name: string
  columns: Column[]
}

export interface Model {
  name: string
  id: number
}

export interface Schema {
  name: string
  models: Model[]
  tables: Table[]
}

