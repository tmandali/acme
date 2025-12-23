"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Settings2,
  Trash2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Database,
  ListFilter,
  Check,
  ArrowLeftRight,
  CalendarIcon,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { format, parse, isValid } from "date-fns"
import { tr } from "date-fns/locale"
import type { Variable } from "../lib/types"
import {
  parseDefaultValues,
  stringifyDefaultValues,
  variableTypeConfig,
  filterTypeConfig,
  generateNameFromLabel
} from "../lib/utils"

// Açılır liste (Combobox) için Varsayılan Değer Bileşeni
function DefaultValueCombobox({
  selectedVariable,
  onUpdate,
}: {
  selectedVariable: Variable
  onUpdate: (updates: Partial<Variable>) => void
}) {
  const [open, setOpen] = useState(false)

  // Parse custom values
  const customValuesList = selectedVariable.customValues
    .split('\n')
    .map(v => v.trim())
    .filter(v => v)
    .map(v => {
      const [value, label] = v.split(',').map(s => s.trim())
      return { value, label: label || value }
    })

  // Parse selected values
  const selectedValues = parseDefaultValues(selectedVariable.defaultValue)

  const handleToggleValue = (value: string) => {
    if (selectedVariable.multiSelect) {
      // Çoklu seçim: toggle
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value]
      onUpdate({ defaultValue: stringifyDefaultValues(newValues) })
    } else {
      // Tek seçim: sadece bu değeri seç veya kaldır
      if (selectedValues.includes(value)) {
        onUpdate({ defaultValue: "" })
      } else {
        onUpdate({ defaultValue: value })
      }
      setOpen(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedValues.length === customValuesList.length) {
      onUpdate({ defaultValue: "" })
    } else {
      onUpdate({ defaultValue: stringifyDefaultValues(customValuesList.map(v => v.value)) })
    }
  }

  const handleClear = () => {
    onUpdate({ defaultValue: "" })
  }

  const isAllSelected = selectedValues.length === customValuesList.length && customValuesList.length > 0
  const isIndeterminate = selectedValues.length > 0 && selectedValues.length < customValuesList.length

  // Görüntüleme metni
  const getDisplayText = () => {
    if (selectedValues.length === 0) return null
    if (selectedVariable.multiSelect) {
      return `${selectedValues.length} seçim`
    } else {
      const item = customValuesList.find(v => v.value === selectedValues[0])
      return item?.label || selectedValues[0]
    }
  }

  const displayText = getDisplayText()

  // Değer listesi boş mu?
  const hasValues = customValuesList.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className={`
            flex items-center justify-between w-full h-9 px-3 rounded-md border bg-transparent text-sm
            transition-colors hover:bg-muted/50
            ${open ? 'border-ring ring-2 ring-ring/20' : 'border-input'}
          `}
        >
          <span className={displayText ? 'text-foreground' : 'text-muted-foreground'}>
            {displayText || 'Değer seçin...'}
          </span>
          <div className="flex items-center gap-1">
            {selectedValues.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleClear()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    e.preventDefault()
                    handleClear()
                  }
                }}
                className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-muted cursor-pointer"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
        {hasValues ? (
          <Command>
            <CommandInput placeholder="Değer ara..." className="h-9" />
            <CommandList>
              <CommandEmpty>Değer bulunamadı.</CommandEmpty>

              {/* Select All - sadece çoklu seçimde göster */}
              {selectedVariable.multiSelect && customValuesList.length > 1 && (
                <CommandGroup>
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${isAllSelected
                        ? 'bg-primary border-primary'
                        : isIndeterminate
                          ? 'bg-primary/50 border-primary/50'
                          : 'border-muted-foreground/30'
                        }`}>
                        {(isAllSelected || isIndeterminate) && (
                          <div className="h-1.5 w-1.5 bg-primary-foreground rounded-sm" />
                        )}
                      </div>
                      <span>Hepsini seç</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {selectedValues.length}/{customValuesList.length}
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}

              <CommandGroup heading={selectedVariable.multiSelect ? "Değerler" : undefined}>
                {customValuesList.map((item) => {
                  const isSelected = selectedValues.includes(item.value)
                  return (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => handleToggleValue(item.value)}
                      className="flex items-center justify-between"
                    >
                      <span>{item.label}</span>
                      <Check className={`h-4 w-4 text-primary transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'
                        }`} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Henüz değer tanımlanmadı</p>
            <p className="text-xs text-muted-foreground">
              Filtre yönteminde &quot;Değerleri Düzenle&quot; butonuna tıklayarak değer ekleyin
            </p>
          </div>
        )}

        {/* Footer - sadece çoklu seçimde ve değerler varsa göster */}
        {selectedVariable.multiSelect && hasValues && (
          <div className="p-2 border-t bg-muted/20">
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setOpen(false)}
            >
              Filtreyi güncelle
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// DatePicker with Input bileşeni
function DatePickerInput({
  value,
  onChange,
  placeholder = "Tarih seçin...",
  size = "default",
  className,
}: {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  size?: "default" | "sm"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date | undefined>(value || new Date())
  const [inputValue, setInputValue] = useState(value && isValid(value) ? format(value, "yyyyMMdd") : "")

  // Value değiştiğinde input'u güncelle
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "yyyyMMdd"))
      setMonth(value)
    } else {
      setInputValue("")
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // yyyyMMdd formatında tarih parse et
    const parsedDate = parse(newValue, "yyyyMMdd", new Date())
    if (isValid(parsedDate) && newValue.length === 8) {
      onChange(parsedDate)
      setMonth(parsedDate)
    }
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date)
    if (date) {
      setInputValue(format(date, "yyyyMMdd"))
    }
    setOpen(false)
  }

  const heightClass = size === "sm" ? "h-8" : "h-9"

  return (
    <div className={`relative flex ${className || ""}`}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`${heightClass} text-sm pr-9 bg-background`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={`absolute top-1/2 right-1 -translate-y-1/2 ${size === "sm" ? "h-6 w-6" : "h-7 w-7"} p-0`}
          >
            <CalendarIcon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            <span className="sr-only">Tarih seç</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={value && isValid(value) ? value : undefined}
            onSelect={handleCalendarSelect}
            month={month && isValid(month) ? month : new Date()}
            onMonthChange={setMonth}
            captionLayout="dropdown"
            locale={tr}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Dinamik badge sayısı hesaplayan çoklu seçim trigger bileşeni
function MultiSelectBadges({
  selectedValues,
  getLabel,
}: {
  selectedValues: string[]
  getLabel: (val: string) => string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(selectedValues.length)

  useEffect(() => {
    const container = containerRef.current
    const measureContainer = measureRef.current
    if (!container || !measureContainer) return

    const calculateVisibleBadges = () => {
      const containerWidth = container.offsetWidth
      const badges = measureContainer.children
      const gap = 4
      const overflowBadgeWidth = 32 // "+X" badge için yaklaşık genişlik

      let totalWidth = 0
      let count = 0

      for (let i = 0; i < badges.length; i++) {
        const badge = badges[i] as HTMLElement
        const badgeWidth = badge.offsetWidth
        const remainingBadges = selectedValues.length - (i + 1)

        // Eğer daha fazla badge varsa, overflow badge için yer ayır
        const needsOverflowSpace = remainingBadges > 0
        const spaceNeeded = totalWidth + badgeWidth + (needsOverflowSpace ? overflowBadgeWidth + gap : 0)

        if (spaceNeeded <= containerWidth) {
          totalWidth += badgeWidth + gap
          count++
        } else {
          break
        }
      }

      setVisibleCount(Math.max(1, count))
    }

    // DOM render olduktan sonra hesapla
    requestAnimationFrame(calculateVisibleBadges)

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(calculateVisibleBadges)
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [selectedValues.length, selectedValues])

  if (selectedValues.length === 0) {
    return <span className="text-muted-foreground">Seçin...</span>
  }

  const showOverflow = selectedValues.length > visibleCount

  return (
    <div ref={containerRef} className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden relative">
      {/* Ölçüm için gizli container */}
      <div ref={measureRef} className="absolute invisible flex items-center gap-1" aria-hidden="true">
        {selectedValues.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium whitespace-nowrap"
          >
            {getLabel(val)}
          </span>
        ))}
      </div>

      {/* Görünen badge'ler */}
      {selectedValues.slice(0, visibleCount).map((val) => (
        <span
          key={val}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium whitespace-nowrap"
        >
          {getLabel(val)}
        </span>
      ))}
      {showOverflow && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium shrink-0">
          +{selectedValues.length - visibleCount}
        </span>
      )}
    </div>
  )
}

interface VariablesPanelProps {
  variables: Variable[]
  onVariablesChange: (variables: Variable[]) => void
  onClose: () => void
  selectedVariable: Variable | null
  onSelectVariable: (variable: Variable | null) => void
  query: string
}

export function VariablesPanel({
  variables,
  onVariablesChange,
  onClose,
  selectedVariable,
  onSelectVariable,
  query,
}: VariablesPanelProps) {
  const [valuesModalOpen, setValuesModalOpen] = useState(false)
  const [tempCustomValues, setTempCustomValues] = useState<Array<{ key: string, value: string }>>([])
  const [valuesInputMode, setValuesInputMode] = useState<"table" | "json">("table")
  const [tempJsonInput, setTempJsonInput] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Bir değişken seçildiğinde otomatik olarak düzenleme moduna geç
  useEffect(() => {
    if (selectedVariable) {
      setIsEditMode(true)
    }
  }, [selectedVariable])

  // SQL'de kullanılan değişkenleri bul (Nunjucks uyumlu)
  const getUsedVariablesInQuery = useCallback(() => {
    const foundVariables: string[] = []

    const ignoredKeywords = new Set([
      'if', 'else', 'elif', 'endif', 'for', 'in', 'endfor',
      'set', 'filter', 'endfilter', 'macro', 'endmacro',
      'include', 'import', 'extends', 'block', 'endblock',
      'and', 'or', 'not', 'true', 'false', 'null', 'none',
      'now', 'loop', 'range', 'item'
    ])

    // {{ ... }} içindeki değişkenleri bul (Fonksiyonel kolon ismi ve filtre argümanları desteği ile)
    const expressionMatches = query.matchAll(/\{\{\s*([\w.]+)(?:\((?:['"]?)(.*?)(?:['"]?)\))?(?:\s*\|\s*[\w]+(?:\(.*?\))?)*\s*\}\}/g)

    for (const match of expressionMatches) {
      const baseVar = match[1].split('.')[0]
      if (baseVar && !ignoredKeywords.has(baseVar) && !foundVariables.includes(baseVar)) {
        foundVariables.push(baseVar)
      }
    }

    // {% ... %} içindeki değişkenleri bul (if, elif, for in, set)
    const tagMatches = query.matchAll(/\{%\s*(?:if|elif|for|set)\s+([^%]+)%}/g)
    for (const match of tagMatches) {
      const words = match[1].match(/\b[a-zA-Z_]\w*\b/g) || []
      for (const word of words) {
        if (word && !ignoredKeywords.has(word) && !foundVariables.includes(word)) {
          foundVariables.push(word)
        }
      }
    }
    return foundVariables
  }, [query])


  const usedVariablesInQuery = getUsedVariablesInQuery()

  const handleAddVariable = () => {
    const defaultLabel = `Kriter ${variables.length + 1}`
    const newVar: Variable = {
      id: `var_${Date.now()}`,
      name: generateNameFromLabel(defaultLabel),
      type: "text",
      label: defaultLabel,
      filterType: "input",
      multiSelect: false,
      defaultValue: "",
      value: "",
      required: true,
      valuesSource: "custom",
      customValues: "",
    }
    onVariablesChange([...variables, newVar])
    onSelectVariable(newVar)
  }

  // String formatından array formatına dönüştür
  const parseCustomValuesToArray = (str: string): Array<{ key: string, value: string }> => {
    if (!str) return [{ key: "", value: "" }]
    const lines = str.split('\n').filter(v => v.trim())
    if (lines.length === 0) return [{ key: "", value: "" }]
    return lines.map(line => {
      const parts = line.split(',').map(s => s.trim())
      return { key: parts[0] || "", value: parts[1] || "" }
    })
  }

  // Array formatından string formatına dönüştür
  const stringifyCustomValuesFromArray = (arr: Array<{ key: string, value: string }>): string => {
    return arr
      .filter(item => item.key.trim())
      .map(item => item.value.trim() ? `${item.key}, ${item.value}` : item.key)
      .join('\n')
  }

  // Array'den JSON string'e dönüştür
  const arrayToJson = (arr: Array<{ key: string, value: string }>): string => {
    const filtered = arr.filter(item => item.key.trim())
    if (filtered.length === 0) return "[]"
    return JSON.stringify(
      filtered.map(item => ({ value: item.key, label: item.value || item.key })),
      null,
      2
    )
  }

  // JSON string'den array'e dönüştür
  const jsonToArray = (json: string): Array<{ key: string, value: string }> | null => {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) return null
      return parsed.map((item: { value?: string; label?: string; key?: string }) => ({
        key: item.value || item.key || "",
        value: item.label || ""
      }))
    } catch {
      return null
    }
  }

  const handleOpenValuesModal = () => {
    if (selectedVariable) {
      const arr = parseCustomValuesToArray(selectedVariable.customValues || "")
      setTempCustomValues(arr)
      setTempJsonInput(arrayToJson(arr))
      setJsonError(null)
      setValuesInputMode("table")
      setValuesModalOpen(true)
    }
  }

  const handleSaveCustomValues = () => {
    if (selectedVariable) {
      if (valuesInputMode === "json") {
        const parsed = jsonToArray(tempJsonInput)
        if (parsed) {
          handleUpdateVariable(selectedVariable.id, { customValues: stringifyCustomValuesFromArray(parsed) })
          setValuesModalOpen(false)
        }
      } else {
        handleUpdateVariable(selectedVariable.id, { customValues: stringifyCustomValuesFromArray(tempCustomValues) })
        setValuesModalOpen(false)
      }
    }
  }

  const handleJsonInputChange = (value: string) => {
    setTempJsonInput(value)
    const parsed = jsonToArray(value)
    if (parsed) {
      setJsonError(null)
    } else if (value.trim()) {
      setJsonError("Geçersiz JSON formatı")
    } else {
      setJsonError(null)
    }
  }

  const handleSwitchToTable = () => {
    if (valuesInputMode === "json") {
      const parsed = jsonToArray(tempJsonInput)
      if (parsed && parsed.length > 0) {
        setTempCustomValues(parsed)
      }
    }
    setValuesInputMode("table")
  }

  const handleSwitchToJson = () => {
    if (valuesInputMode === "table") {
      setTempJsonInput(arrayToJson(tempCustomValues))
    }
    setJsonError(null)
    setValuesInputMode("json")
  }

  const handleAddCustomValueRow = () => {
    setTempCustomValues([...tempCustomValues, { key: "", value: "" }])
  }

  const handleRemoveCustomValueRow = (index: number) => {
    if (tempCustomValues.length <= 1) return
    setTempCustomValues(tempCustomValues.filter((_, i) => i !== index))
  }

  const handleUpdateCustomValueRow = (index: number, field: "key" | "value", newValue: string) => {
    setTempCustomValues(tempCustomValues.map((item, i) =>
      i === index ? { ...item, [field]: newValue } : item
    ))
  }

  const handleDeleteVariable = (id: string) => {
    onVariablesChange(variables.filter(v => v.id !== id))
    if (selectedVariable?.id === id) {
      onSelectVariable(null)
    }
  }

  const handleUpdateVariable = (id: string, updates: Partial<Variable>) => {
    onVariablesChange(variables.map(v => v.id === id ? { ...v, ...updates } : v))
    if (selectedVariable?.id === id) {
      onSelectVariable({ ...selectedVariable, ...updates })
    }
  }

  const handleMoveVariable = (id: string, direction: "up" | "down") => {
    const index = variables.findIndex(v => v.id === id)
    if (index === -1) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= variables.length) return

    const newVariables = [...variables]
    const [removed] = newVariables.splice(index, 1)
    newVariables.splice(newIndex, 0, removed)
    onVariablesChange(newVariables)

    // Seçili değişkeni yeni array'den güncelle
    if (selectedVariable?.id === id) {
      const updatedVariable = newVariables.find(v => v.id === id)
      if (updatedVariable) {
        onSelectVariable(updatedVariable)
      }
    }
  }

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[53px] border-b bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">Kriterler</span>
          {variables.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {variables.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {variables.length > 0 && (
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-mode"
                checked={isEditMode}
                onCheckedChange={setIsEditMode}
              />
              <Label htmlFor="edit-mode" className="text-xs cursor-pointer">Düzenle</Label>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Variables List / Value Entry */}
      <div className="flex-1 overflow-auto">
        {variables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 mb-4">
              <Settings2 className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Henüz kriter yok</p>
            <p className="text-xs text-muted-foreground text-center mb-2">
              SQL sorgusuna kriter eklemek için
            </p>
            <div className="flex flex-col gap-1.5 w-full mt-4">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded border border-dashed text-[10px] font-mono text-muted-foreground">
                <span className="text-primary">{"{{ "}</span>
                <span>DEĞİŞKEN</span>
                <span className="text-primary">{"('KOLON') | eq }}"}</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded border border-dashed text-[10px] font-mono text-muted-foreground">
                <span className="text-primary">{"{{ "}</span>
                <span>TARİH</span>
                <span className="text-primary">{" | between }}"}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-3 px-4 italic">
              Nunjucks sözdizimi ve fonksiyonel kolon isimleri (Örn: VAR(&apos;KOLON&apos;)) kullanabilirsiniz.
            </p>


          </div>
        ) : !isEditMode ? (
          /* Value Entry Mode - Değer Giriş Modu (sadece SQL'de kullanılanlar) */
          <div className="p-4 space-y-4">
            {variables
              .filter((v) => usedVariablesInQuery.includes(v.name))
              .map((variable) => {
                // Açık/Kapalı ve Aralık filtre yöntemi için özel ikon ve renk
                const isBetween = variable.filterType === "between"
                const typeConfig = variableTypeConfig[variable.type]
                const TypeIcon = isBetween ? ArrowLeftRight : typeConfig.icon
                const iconColor = isBetween ? "text-cyan-500" : typeConfig.color

                // Değer girişi için uygun input'u render et
                const renderValueInput = () => {
                  // Açılır liste (dropdown) için ComboBox
                  if (variable.filterType === "dropdown") {
                    const options = variable.customValues
                      ? variable.customValues.split('\n').filter(v => v.trim()).map(v => {
                        const parts = v.split(',').map(s => s.trim())
                        return { value: parts[0], label: parts[1] || parts[0] }
                      })
                      : []

                    // Değerden label'a dönüşüm helper'ı
                    const getLabel = (val: string) => options.find(o => o.value === val)?.label || val

                    // Çoklu seçim için mevcut değerleri parse et (value alanını kullan, yoksa defaultValue)
                    const activeValue = variable.value || variable.defaultValue
                    const selectedValues = variable.multiSelect
                      ? parseDefaultValues(activeValue)
                      : [activeValue].filter(Boolean)

                    const handleToggleValue = (val: string) => {
                      if (variable.multiSelect) {
                        const currentValues = parseDefaultValues(activeValue)
                        const newValues = currentValues.includes(val)
                          ? currentValues.filter(v => v !== val)
                          : [...currentValues, val]
                        handleUpdateVariable(variable.id, {
                          value: newValues.length > 0 ? JSON.stringify(newValues) : ""
                        })
                      } else {
                        handleUpdateVariable(variable.id, { value: val })
                      }
                    }

                    const handleSelectAll = () => {
                      const allValues = options.map(o => o.value)
                      handleUpdateVariable(variable.id, {
                        value: JSON.stringify(allValues)
                      })
                    }

                    const handleClearAll = () => {
                      handleUpdateVariable(variable.id, { value: "" })
                    }

                    // Çoklu seçim görünümü
                    if (variable.multiSelect) {
                      return (
                        <div className="space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="flex items-center justify-between w-full min-h-9 px-3 py-2 rounded-md border bg-background text-sm hover:bg-muted/50 transition-colors"
                              >
                                <MultiSelectBadges
                                  selectedValues={selectedValues}
                                  getLabel={getLabel}
                                />
                                <div className="flex items-center gap-1 ml-2 shrink-0">
                                  {selectedValues.length > 0 && (
                                    <span
                                      role="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleClearAll()
                                      }}
                                      className="h-4 w-4 rounded-sm hover:bg-muted flex items-center justify-center"
                                    >
                                      <X className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                  )}
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Ara..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={selectedValues.length === options.length ? handleClearAll : handleSelectAll}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${selectedValues.length === options.length
                                          ? 'bg-primary border-primary'
                                          : selectedValues.length > 0
                                            ? 'bg-primary/50 border-primary/50'
                                            : 'border-muted-foreground/30'
                                          }`}>
                                          {selectedValues.length > 0 && (
                                            <div className="h-1.5 w-1.5 bg-primary-foreground rounded-sm" />
                                          )}
                                        </div>
                                        <span className="font-medium">
                                          {selectedValues.length === options.length ? "Tümünü kaldır" : "Tümünü seç"}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">
                                        {selectedValues.length}/{options.length}
                                      </span>
                                    </CommandItem>
                                  </CommandGroup>
                                  <CommandGroup>
                                    {options.map((option) => {
                                      const isSelected = selectedValues.includes(option.value)
                                      return (
                                        <CommandItem
                                          key={option.value}
                                          onSelect={() => handleToggleValue(option.value)}
                                          className="flex items-center justify-between"
                                        >
                                          <span>{option.label}</span>
                                          <Check className={`h-4 w-4 text-primary transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'
                                            }`} />
                                        </CommandItem>
                                      )
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )
                    }

                    // Tek seçim görünümü
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="flex items-center justify-between w-full h-9 px-3 rounded-md border bg-background text-sm hover:bg-muted/50 transition-colors"
                          >
                            <span className={selectedValues.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                              {selectedValues[0] ? getLabel(selectedValues[0]) : "Seçin..."}
                            </span>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              {selectedValues.length > 0 && (
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdateVariable(variable.id, { value: "" })
                                  }}
                                  className="h-4 w-4 rounded-sm hover:bg-muted flex items-center justify-center"
                                >
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </span>
                              )}
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Ara..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                              <CommandGroup>
                                {options.map((option) => {
                                  const isSelected = selectedValues.includes(option.value)
                                  return (
                                    <CommandItem
                                      key={option.value}
                                      onSelect={() => handleToggleValue(option.value)}
                                      className="flex items-center justify-between"
                                    >
                                      <span>{option.label}</span>
                                      <Check className={`h-4 w-4 text-primary transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'
                                        }`} />
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )
                  }

                  // Between filtre yöntemi için iki input
                  if (variable.filterType === "between") {
                    const activeStart = variable.value ? (JSON.parse(variable.value)?.start || "") : (variable.betweenStart || "")
                    const activeEnd = variable.value ? (JSON.parse(variable.value)?.end || "") : (variable.betweenEnd || "")

                    const handleBetweenChange = (field: "start" | "end", val: string) => {
                      const current = variable.value ? JSON.parse(variable.value) : { start: variable.betweenStart || "", end: variable.betweenEnd || "" }
                      current[field] = val

                      // Doğrulama: Bitiş başlangıçtan küçük olamaz
                      if (current.start && current.end) {
                        if (variable.type === "number") {
                          const s = Number(current.start)
                          const e = Number(current.end)
                          if (!isNaN(s) && !isNaN(e)) {
                            if (field === "start" && s > e) current.end = current.start
                            if (field === "end" && e < s) current.start = current.end
                          }
                        } else if (variable.type === "date" || variable.type === "text") {
                          if (field === "start" && current.start > current.end) current.end = current.start
                          if (field === "end" && current.end < current.start) current.start = current.end
                        }
                      }

                      handleUpdateVariable(variable.id, { value: JSON.stringify(current) })
                    }


                    // Tarih tipi için DatePicker kullan
                    if (variable.type === "date") {
                      const startDateValue = activeStart ? parse(activeStart, "yyyyMMdd", new Date()) : undefined
                      const endDateValue = activeEnd ? parse(activeEnd, "yyyyMMdd", new Date()) : undefined
                      const isValidStartDate = startDateValue && isValid(startDateValue)
                      const isValidEndDate = endDateValue && isValid(endDateValue)

                      return (
                        <div className="flex items-center gap-2">
                          <DatePickerInput
                            value={isValidStartDate ? startDateValue : undefined}
                            onChange={(date) => handleBetweenChange("start", date ? format(date, "yyyyMMdd") : "")}
                            placeholder="Başlangıç"
                            className="flex-1"
                          />
                          <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <DatePickerInput
                            value={isValidEndDate ? endDateValue : undefined}
                            onChange={(date) => handleBetweenChange("end", date ? format(date, "yyyyMMdd") : "")}
                            placeholder="Bitiş"
                            className="flex-1"
                          />
                        </div>
                      )
                    }

                    const inputType = variable.type === "number" ? "number" : "text"

                    return (
                      <div className="flex items-center gap-2">
                        <Input
                          type={inputType}
                          value={activeStart}
                          onChange={(e) => handleBetweenChange("start", e.target.value)}
                          placeholder="Başlangıç"
                          className="h-9 text-sm flex-1"
                        />
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          type={inputType}
                          value={activeEnd}
                          onChange={(e) => handleBetweenChange("end", e.target.value)}
                          placeholder="Bitiş"
                          className="h-9 text-sm flex-1"
                        />
                      </div>
                    )
                  }

                  // Aktif değeri al (value yoksa defaultValue)
                  const activeInputValue = variable.value !== undefined && variable.value !== ""
                    ? variable.value
                    : variable.defaultValue

                  // Tarih tipi için DatePicker with Input
                  if (variable.type === "date") {
                    const dateValue = activeInputValue ? parse(activeInputValue, "yyyyMMdd", new Date()) : undefined
                    const isValidDateValue = dateValue && isValid(dateValue)

                    return (
                      <DatePickerInput
                        value={isValidDateValue ? dateValue : undefined}
                        onChange={(date) => {
                          handleUpdateVariable(variable.id, {
                            value: date ? format(date, "yyyyMMdd") : ""
                          })
                        }}
                        placeholder="Tarih seçin..."
                      />
                    )
                  }

                  // Sayı tipi için number input
                  if (variable.type === "number") {
                    return (
                      <Input
                        type="number"
                        value={activeInputValue}
                        onChange={(e) => handleUpdateVariable(variable.id, { value: e.target.value })}
                        placeholder="Sayı girin..."
                        className="h-9 text-sm"
                      />
                    )
                  }

                  // Varsayılan: text input with optional regex validation
                  const hasRegex = variable.regexPattern && variable.regexPattern.trim() !== ""
                  let isRegexValid = true
                  if (hasRegex && activeInputValue) {
                    try {
                      const regex = new RegExp(variable.regexPattern!)
                      isRegexValid = regex.test(activeInputValue)
                    } catch {
                      isRegexValid = true // Invalid regex pattern, ignore validation
                    }
                  }

                  return (
                    <div className="space-y-1">
                      <Input
                        type="text"
                        value={activeInputValue}
                        onChange={(e) => handleUpdateVariable(variable.id, { value: e.target.value })}
                        placeholder="Değer girin..."
                        className={`h-9 text-sm ${hasRegex && activeInputValue && !isRegexValid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      {hasRegex && activeInputValue && !isRegexValid && (
                        <p className="text-[10px] text-destructive">
                          {variable.regexErrorMessage || "Geçersiz format"}
                        </p>
                      )}
                    </div>
                  )
                }


                return (
                  <div key={variable.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <TypeIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                      <Label className="text-sm font-medium">{variable.label}</Label>
                      {variable.required && (
                        <span className="text-[10px] text-destructive">*</span>
                      )}
                      {variable.regexPattern && (
                        <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">
                          regex
                        </span>
                      )}
                    </div>
                    {renderValueInput()}
                  </div>
                )
              })}
          </div>
        ) : (
          /* Edit Mode - Düzenleme Modu */
          <div className="p-3 space-y-1.5">
            {variables.map((variable) => {
              // Açık/Kapalı ve Aralık filtre yöntemi için özel ikon ve renk
              const isBetween = variable.filterType === "between"
              const typeConfig = variableTypeConfig[variable.type]
              const TypeIcon = isBetween ? ArrowLeftRight : typeConfig.icon
              const iconColor = isBetween ? "text-cyan-500" : typeConfig.color
              const isUsedInQuery = usedVariablesInQuery.includes(variable.name)
              return (
                <div
                  key={variable.id}
                  onClick={() => onSelectVariable(variable)}
                  className={`
                    flex items-center gap-2.5 py-1.5 px-2.5 rounded-md cursor-pointer group transition-colors
                    ${selectedVariable?.id === variable.id
                      ? 'bg-muted ring-1 ring-border'
                      : 'hover:bg-muted/50'
                    }
                    ${!isUsedInQuery ? 'opacity-60' : ''}
                  `}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${iconColor}`}>
                    <TypeIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{variable.label}</span>
                      {!isUsedInQuery && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                          SQL&apos;de yok
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={variables.findIndex(v => v.id === variable.id) === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveVariable(variable.id, "up")
                      }}
                    >
                      <ArrowUp className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={variables.findIndex(v => v.id === variable.id) === variables.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveVariable(variable.id, "down")
                      }}
                    >
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteVariable(variable.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected Variable Details - Only in Edit Mode */}
        {isEditMode && selectedVariable && (
          <div className="border-t bg-muted/10">
            {/* Detail Header */}
            <div className="px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const isBetween = selectedVariable.filterType === "between"
                    const TypeIcon = isBetween ? ArrowLeftRight : variableTypeConfig[selectedVariable.type].icon
                    const iconColor = isBetween ? "text-cyan-500" : variableTypeConfig[selectedVariable.type].color
                    return <TypeIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                  })()}
                  <span className="text-xs font-mono font-medium">{selectedVariable.name}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border border-dashed text-[10px] font-mono text-muted-foreground">
                  <span className="text-primary/70">{"{{ "}</span>
                  <span className="text-foreground/80">{selectedVariable.name}</span>
                  <span className="text-primary/70">{" | sql }}"}</span>
                </div>
              </div>
            </div>


            <div className="p-4 space-y-5">
              {/* Değişken Tipi - Açık/Kapalı filtre yönteminde gösterme */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Değişken Tipi</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(variableTypeConfig) as [Variable["type"], typeof variableTypeConfig[Variable["type"]]][]).map(([type, config]) => {
                    const Icon = config.icon
                    const isSelected = selectedVariable.type === type
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          // Tip değiştiğinde değerleri sıfırla
                          if (selectedVariable.type !== type) {
                            handleUpdateVariable(selectedVariable.id, {
                              type,
                              defaultValue: "",
                            })
                          }
                        }}
                        className={`
                            flex items-center gap-2 p-2.5 rounded-md border transition-all text-left
                            ${isSelected
                            ? 'border-foreground/20 bg-muted'
                            : 'border-transparent hover:bg-muted/50'
                          }
                          `}
                      >
                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        <span className="text-xs font-medium">{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Etiket */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Görünen Etiket</Label>
                <Input
                  value={selectedVariable.label}
                  onChange={(e) => handleUpdateVariable(selectedVariable.id, { label: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="Kullanıcıya gösterilecek isim"
                />
              </div>

              {/* Filtre Yöntemi */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filtre Yöntemi</Label>
                <div className="space-y-2">
                  {(Object.entries(filterTypeConfig) as [Variable["filterType"], typeof filterTypeConfig[Variable["filterType"]]][]).map(([filterType, config]) => {
                    const Icon = config.icon
                    const isSelected = selectedVariable.filterType === filterType
                    return (
                      <div
                        key={filterType}
                        onClick={() => handleUpdateVariable(selectedVariable.id, { filterType })}
                        className={`
                          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${isSelected
                            ? 'border-foreground/20 bg-muted'
                            : 'border-transparent hover:bg-muted/50'
                          }
                        `}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-foreground/10' : 'bg-muted'}`}>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{config.label}</span>
                            {filterType === "dropdown" && isSelected && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenValuesModal()
                                }}
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground -mr-1"
                              >
                                Değerleri Düzenle
                              </Button>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>


              {/* Between Varsayılan Değerleri - Sadece between filtre yöntemi için */}
              {selectedVariable.filterType === "between" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Varsayılan Aralık</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 shrink-0">
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Başlangıç:</span>
                        </div>
                        {selectedVariable.type === "date" ? (
                          <DatePickerInput
                            value={selectedVariable.betweenStart ? parse(selectedVariable.betweenStart, "yyyyMMdd", new Date()) : undefined}
                            onChange={(date) => {
                              const val = date ? format(date, "yyyyMMdd") : ""
                              let currentEnd = selectedVariable.betweenEnd || ""

                              // Doğrulama: Bitiş başlangıçtan küçük olamaz
                              if (val && currentEnd && val > currentEnd) {
                                currentEnd = val
                              }

                              handleUpdateVariable(selectedVariable.id, {
                                betweenStart: val,
                                betweenEnd: currentEnd,
                                defaultValue: JSON.stringify({ start: val, end: currentEnd })
                              })
                            }}

                            placeholder="Başlangıç"
                            size="sm"
                            className="flex-1"
                          />
                        ) : (
                          <Input
                            type={selectedVariable.type === "number" ? "number" : "text"}
                            value={selectedVariable.betweenStart || ""}
                            onChange={(e) => {
                              const val = e.target.value
                              let currentEnd = selectedVariable.betweenEnd || ""

                              // Doğrulama: Bitiş başlangıçtan küçük olamaz
                              if (val && currentEnd) {
                                if (selectedVariable.type === "number") {
                                  const s = Number(val), eVal = Number(currentEnd)
                                  if (!isNaN(s) && !isNaN(eVal) && s > eVal) currentEnd = val
                                } else if (val > currentEnd) {
                                  currentEnd = val
                                }
                              }

                              handleUpdateVariable(selectedVariable.id, {
                                betweenStart: val,
                                betweenEnd: currentEnd,
                                defaultValue: JSON.stringify({ start: val, end: currentEnd })
                              })
                            }}

                            placeholder="Başlangıç değeri"
                            className="h-8 text-sm"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 shrink-0">
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Bitiş:</span>
                        </div>
                        {selectedVariable.type === "date" ? (
                          <DatePickerInput
                            value={selectedVariable.betweenEnd ? parse(selectedVariable.betweenEnd, "yyyyMMdd", new Date()) : undefined}
                            onChange={(date) => {
                              const val = date ? format(date, "yyyyMMdd") : ""
                              let currentStart = selectedVariable.betweenStart || ""

                              // Doğrulama: Bitiş başlangıçtan küçük olamaz
                              if (val && currentStart && val < currentStart) {
                                currentStart = val
                              }

                              handleUpdateVariable(selectedVariable.id, {
                                betweenEnd: val,
                                betweenStart: currentStart,
                                defaultValue: JSON.stringify({ start: currentStart, end: val })
                              })
                            }}

                            placeholder="Bitiş"
                            size="sm"
                            className="flex-1"
                          />
                        ) : (
                          <Input
                            type={selectedVariable.type === "number" ? "number" : "text"}
                            value={selectedVariable.betweenEnd || ""}
                            onChange={(e) => {
                              const val = e.target.value
                              let currentStart = selectedVariable.betweenStart || ""

                              // Doğrulama: Bitiş başlangıçtan küçük olamaz
                              if (val && currentStart) {
                                if (selectedVariable.type === "number") {
                                  const eVal = Number(val), s = Number(currentStart)
                                  if (!isNaN(eVal) && !isNaN(s) && eVal < s) currentStart = val
                                } else if (val < currentStart) {
                                  currentStart = val
                                }
                              }

                              handleUpdateVariable(selectedVariable.id, {
                                betweenEnd: val,
                                betweenStart: currentStart,
                                defaultValue: JSON.stringify({ start: currentStart, end: val })
                              })
                            }}

                            placeholder="Bitiş değeri"
                            className="h-8 text-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Aralık filtresinin varsayılan başlangıç ve bitiş değerleri
                  </p>
                </div>
              )}

              {/* Çoklu Seçim - Between filtre yönteminde gösterme */}
              {selectedVariable.filterType !== "between" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Seçim Sayısı</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateVariable(selectedVariable.id, { multiSelect: false })}
                      className={`
                      flex-1 flex items-center justify-center gap-2 p-2.5 rounded-md border transition-all
                      ${!selectedVariable.multiSelect
                          ? 'border-foreground/20 bg-muted'
                          : 'border-transparent hover:bg-muted/50'
                        }
                    `}
                    >
                      <div className="h-3 w-3 rounded-full border-2 border-current flex items-center justify-center">
                        {!selectedVariable.multiSelect && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </div>
                      <span className="text-xs font-medium">Tek değer</span>
                    </button>
                    <button
                      onClick={() => handleUpdateVariable(selectedVariable.id, { multiSelect: true })}
                      className={`
                      flex-1 flex items-center justify-center gap-2 p-2.5 rounded-md border transition-all
                      ${selectedVariable.multiSelect
                          ? 'border-foreground/20 bg-muted'
                          : 'border-transparent hover:bg-muted/50'
                        }
                    `}
                    >
                      <div className="h-3 w-3 rounded border border-current flex items-center justify-center">
                        {selectedVariable.multiSelect && <ChevronUp className="h-2 w-2" style={{ transform: 'rotate(45deg) scale(0.8)' }} />}
                      </div>
                      <span className="text-xs font-medium">Çoklu değer</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Varsayılan Değer - Between filtre yönteminde gösterme */}
              {selectedVariable.filterType !== "between" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Varsayılan Değer</Label>

                  {/* Açılır liste seçiliyse → Combobox */}
                  {selectedVariable.filterType === "dropdown" ? (
                    <DefaultValueCombobox
                      selectedVariable={selectedVariable}
                      onUpdate={(updates) => handleUpdateVariable(selectedVariable.id, updates)}
                    />
                  ) : selectedVariable.type === "date" ? (
                    /* Tarih tipi için DatePicker */
                    <DatePickerInput
                      value={selectedVariable.defaultValue ? parse(selectedVariable.defaultValue, "yyyyMMdd", new Date()) : undefined}
                      onChange={(date) => handleUpdateVariable(selectedVariable.id, { defaultValue: date ? format(date, "yyyyMMdd") : "" })}
                      placeholder="Varsayılan tarih seçin"
                    />
                  ) : (
                    /* Arama kutusu veya Girdi kutusu → Text Input */
                    <Input
                      value={selectedVariable.defaultValue}
                      onChange={(e) => handleUpdateVariable(selectedVariable.id, { defaultValue: e.target.value })}
                      placeholder="Varsayılan bir değer girin"
                      className="h-9 text-sm"
                    />
                  )}
                </div>
              )}

              {/* Regex Pattern - Sadece text tipi ve input filter için */}
              {selectedVariable.type === "text" && selectedVariable.filterType === "input" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Regex Doğrulama</Label>
                    <Input
                      value={selectedVariable.regexPattern || ""}
                      onChange={(e) => handleUpdateVariable(selectedVariable.id, { regexPattern: e.target.value })}
                      placeholder="Örn: ^[A-Z]{2}-\d{4}$"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Girilen değerin uyması gereken regex pattern
                    </p>
                  </div>
                  {selectedVariable.regexPattern && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hata Mesajı</Label>
                      <Input
                        value={selectedVariable.regexErrorMessage || ""}
                        onChange={(e) => handleUpdateVariable(selectedVariable.id, { regexErrorMessage: e.target.value })}
                        placeholder="Geçersiz format"
                        className="h-9 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Regex eşleşmezse gösterilecek mesaj
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Zorunlu */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-transparent hover:bg-muted/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">Her zaman bir değer gerektirir</div>
                  <p className="text-[11px] text-muted-foreground">
                    Etkinleştirildiğinde, insanlar değeri değiştirebilir veya sıfırlayabilir, ancak tamamen silemezler.
                  </p>
                </div>
                <Switch
                  checked={selectedVariable.required}
                  onCheckedChange={(checked) => handleUpdateVariable(selectedVariable.id, { required: checked })}
                />
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Seçilebilir Değerler Modal */}
      <Dialog open={valuesModalOpen} onOpenChange={setValuesModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b bg-muted/30">
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              {selectedVariable?.label} için seçenekler
            </DialogTitle>
          </DialogHeader>

          {/* Veri Kaynağı Seçimi */}
          <div className="px-5 py-4 border-b bg-muted/5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Veri Kaynağı
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => selectedVariable && handleUpdateVariable(selectedVariable.id, { valuesSource: "model" })}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-all text-sm
                  ${selectedVariable?.valuesSource === "model"
                    ? 'border-foreground/20 bg-muted font-medium'
                    : 'border-transparent hover:bg-muted/50'
                  }
                `}
              >
                <Database className="h-4 w-4 text-muted-foreground" />
                Model / Sorgu
              </button>
              <button
                onClick={() => selectedVariable && handleUpdateVariable(selectedVariable.id, { valuesSource: "custom" })}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-all text-sm
                  ${selectedVariable?.valuesSource === "custom"
                    ? 'border-foreground/20 bg-muted font-medium'
                    : 'border-transparent hover:bg-muted/50'
                  }
                `}
              >
                <ListFilter className="h-4 w-4 text-muted-foreground" />
                Özel Liste
              </button>
            </div>
          </div>

          {/* Mod Seçici */}
          {selectedVariable?.valuesSource === "custom" && (
            <div className="px-5 py-2 border-b bg-background flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={handleSwitchToTable}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${valuesInputMode === "table"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                    }`}
                >
                  Tablo
                </button>
                <button
                  onClick={handleSwitchToJson}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${valuesInputMode === "json"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                    }`}
                >
                  JSON
                </button>
              </div>
              {valuesInputMode === "json" && (
                <span className="text-[10px] text-muted-foreground">
                  Format: {"[{\"value\": \"1\", \"label\": \"Etiket\"}]"}
                </span>
              )}
            </div>
          )}

          {/* Değerler - Tablo Modu */}
          {valuesInputMode === "table" && (
            <div className={`max-h-[280px] overflow-auto ${selectedVariable?.valuesSource !== "custom" ? 'opacity-40 pointer-events-none' : ''
              }`}>
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2 border-b border-r w-10">
                      #
                    </th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2 border-b border-r w-1/2">
                      Değer
                    </th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2 border-b border-r">
                      Görünen Etiket
                    </th>
                    <th className="w-8 border-b bg-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {tempCustomValues.map((item, index) => (
                    <tr key={index} className="group hover:bg-muted/20 transition-colors">
                      <td className="text-center text-muted-foreground border-b border-r py-0.5 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="border-b border-r p-0">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => handleUpdateCustomValueRow(index, "key", e.target.value)}
                          placeholder="değer"
                          className="w-full h-8 px-3 bg-transparent text-sm font-mono focus:outline-none focus:bg-muted/30"
                          disabled={selectedVariable?.valuesSource !== "custom"}
                        />
                      </td>
                      <td className="border-b border-r p-0">
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleUpdateCustomValueRow(index, "value", e.target.value)}
                          placeholder="etiket (opsiyonel)"
                          className="w-full h-8 px-3 bg-transparent text-sm focus:outline-none focus:bg-muted/30"
                          disabled={selectedVariable?.valuesSource !== "custom"}
                        />
                      </td>
                      <td className="border-b p-0">
                        <button
                          className="w-full h-8 flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                          onClick={() => handleRemoveCustomValueRow(index)}
                          disabled={selectedVariable?.valuesSource !== "custom" || tempCustomValues.length <= 1}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Değerler - JSON Modu */}
          {valuesInputMode === "json" && (
            <div className={`p-4 ${selectedVariable?.valuesSource !== "custom" ? 'opacity-40 pointer-events-none' : ''
              }`}>
              <Textarea
                value={tempJsonInput}
                onChange={(e) => handleJsonInputChange(e.target.value)}
                placeholder={`[\n  { "value": "1", "label": "Aktif" },\n  { "value": "2", "label": "Pasif" }\n]`}
                className={`min-h-[240px] font-mono text-sm resize-none ${jsonError ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                disabled={selectedVariable?.valuesSource !== "custom"}
              />
              {jsonError && (
                <p className="text-xs text-destructive mt-2">{jsonError}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
            <div className="flex items-center gap-3">
              {selectedVariable?.valuesSource === "custom" && valuesInputMode === "table" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomValueRow}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Satır Ekle
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {tempCustomValues.filter(item => item.key.trim()).length} değer
                  </span>
                </>
              )}
              {selectedVariable?.valuesSource === "custom" && valuesInputMode === "json" && !jsonError && (
                <span className="text-[10px] text-muted-foreground">
                  {(() => {
                    const parsed = jsonToArray(tempJsonInput)
                    return parsed ? `${parsed.filter(i => i.key.trim()).length} değer` : ""
                  })()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={() => setValuesModalOpen(false)}>
                İptal
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={handleSaveCustomValues}
                disabled={valuesInputMode === "json" && !!jsonError}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

