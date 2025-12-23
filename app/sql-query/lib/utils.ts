import type { Variable } from "./types"
import nunjucks from "nunjucks"

import {
  Key, Link2, ToggleLeft, Clock, FileJson, FileText, Circle,
  Type, Hash, Calendar, ListFilter, ChevronDown, TextCursorInput, ArrowLeftRight
} from "lucide-react"
import { format, addDays, parse, isValid } from "date-fns"



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
// Filtre tipi config
export const filterTypeConfig: Record<Variable["filterType"], { icon: React.ElementType; label: string; description: string }> = {
  dropdown: { icon: ChevronDown, label: "Açılır liste", description: "Önceden tanımlanmış seçeneklerden seç" },
  input: { icon: TextCursorInput, label: "Girdi kutusu", description: "Serbest metin girişi" },
  between: { icon: ArrowLeftRight, label: "Aralık", description: "Başlangıç ve bitiş değeri arasında filtrele" },
}

// Kolon ikon helper
export function getColumnIcon(type: string, hasFk?: boolean) {
  if (hasFk) return { icon: Link2, color: "text-rose-500" }
  return columnTypeConfig[type] || { icon: Circle, color: "text-muted-foreground" }
}

// Nunjucks ortamını yapılandır
const nunjucksEnv = nunjucks.configure({ autoescape: false });


// SQL için özel filtreler ekle
nunjucksEnv.addFilter('quote', (val) => {
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) return val.map(v => typeof v === 'number' ? v : `'${v}'`).join(', ');
  return `'${val}'`;
});


nunjucksEnv.addFilter('sql', (val) => {
  if (val === undefined || val === null || val === '') return 'NULL';
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) {
    const joined = val.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
    return `(${joined})`;
  }
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${val}'`;
});

// Değerin bir aralık nesnesi olup olmadığını kontrol et
const isRange = (val: any) => val && typeof val === 'object' && ('start' in val || 'begin' in val);

// Aralığın parçalarına erişim
nunjucksEnv.addFilter('begin', (val) => isRange(val) ? (val.begin || val.start) : val);
nunjucksEnv.addFilter('start', (val) => isRange(val) ? (val.start || val.begin) : val);
nunjucksEnv.addFilter('end', (val) => isRange(val) ? (val.finish || val.end) : val);
nunjucksEnv.addFilter('finish', (val) => isRange(val) ? (val.finish || val.end) : val);

const formatSqlValue = (val: any) => {
  if (val === undefined || val === null || val === '') return null;
  return typeof val === 'number' ? val : `'${val}'`;
};

// Bitiş değeri ayarlama (end_offset için ortak mantık)
const getAdjustedEndValue = (end: any, endOffset: any) => {
  if (!endOffset) return end;

  let adjustedEnd = end;
  const offset = Number(endOffset);

  if (typeof end === 'number') {
    adjustedEnd = end + offset;
  } else if (typeof end === 'string' && /^\d{8}$/.test(end)) {
    // yyyyMMdd formatında tarih ise n gün ekle
    try {
      const date = parse(end, "yyyyMMdd", new Date());
      if (isValid(date)) {
        adjustedEnd = format(addDays(date, offset), "yyyyMMdd");
      } else {
        adjustedEnd = end + 'Z';
      }
    } catch (e) {
      adjustedEnd = end + 'Z';
    }
  } else if (typeof end === 'string' && end !== "") {
    adjustedEnd = end + 'Z';
  }
  return adjustedEnd;
};

// > Greater Than
nunjucksEnv.addFilter('gt', (val, fieldName) => {
  const f = formatSqlValue(val);
  if (f === null) return '';
  const prefix = fieldName ? `${fieldName} > ` : '> ';
  return `${prefix}${f}`;
});

// < Less Than
nunjucksEnv.addFilter('lt', (val, fieldName) => {
  const f = formatSqlValue(val);
  if (f === null) return '';
  const prefix = fieldName ? `${fieldName} < ` : '< ';
  return `${prefix}${f}`;
});

// >= Greater Than or Equal To
const gteFunc = (val: any, fieldName?: string) => {
  const f = formatSqlValue(val);
  if (f === null) return '';
  const prefix = fieldName ? `${fieldName} >= ` : '>= ';
  return `${prefix}${f}`;
};
nunjucksEnv.addFilter('gte', gteFunc);
nunjucksEnv.addFilter('ge', gteFunc);

// <= Less Than or Equal To
const lteFunc = (val: any, fieldName?: string) => {
  const f = formatSqlValue(val);
  if (f === null) return '';
  const prefix = fieldName ? `${fieldName} <= ` : '<= ';
  return `${prefix}${f}`;
};
nunjucksEnv.addFilter('lte', lteFunc);
nunjucksEnv.addFilter('le', lteFunc);


// == Equal (Smart: handles null and IN)
const eqFunc = (val: any, fieldName?: string) => {
  if (val === undefined || val === null || val === '') {
    return fieldName ? `${fieldName} IS NULL` : 'IS NULL';
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return fieldName ? `${fieldName} IS NULL` : 'IS NULL';
    const joined = val.map(v => typeof v === 'number' ? v : `'${v}'`).join(', ');
    return fieldName ? `${fieldName} IN (${joined})` : `IN (${joined})`;
  }
  const f = formatSqlValue(val);
  return fieldName ? `${fieldName} = ${f}` : `= ${f}`;
};
nunjucksEnv.addFilter('eq', eqFunc);


// != Not Equal
nunjucksEnv.addFilter('ne', (val, fieldName) => {
  if (val === undefined || val === null || val === '') {
    return fieldName ? `${fieldName} IS NOT NULL` : 'IS NOT NULL';
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return fieldName ? `${fieldName} IS NOT NULL` : 'IS NOT NULL';
    const joined = val.map(v => typeof v === 'number' ? v : `'${v}'`).join(', ');
    return fieldName ? `${fieldName} NOT IN (${joined})` : `NOT IN (${joined})`;
  }
  const f = formatSqlValue(val);
  return fieldName ? `${fieldName} <> ${f}` : `<> ${f}`;
});


// Benzer şekilde LIKE için
nunjucksEnv.addFilter('like', (val, fieldName) => {
  if (val === undefined || val === null || val === '') return fieldName ? `${fieldName} IS NOT NULL` : 'IS NOT NULL';
  return fieldName ? `${fieldName} LIKE '%${val}%'` : `LIKE '%${val}%'`;
});


// BETWEEN filtresi: Aralık nesnesini alır ve BETWEEN 'start' AND 'end' üretir.
// end_offset parametresi eklenirse range gibi davranır (>= ve < kullanır)
nunjucksEnv.addFilter('between', function (val, fieldName, options) {
  let actualFieldName = typeof fieldName === 'string' ? fieldName : '';
  let opts = (typeof fieldName === 'object' ? fieldName : options) || {};

  if (val && typeof val === 'object' && ('start' in val || 'begin' in val)) {
    const start = val.start || val.begin;
    const end = val.finish || val.end;

    if (!start && !end) return '1=1';

    const adjustedEnd = getAdjustedEndValue(end, opts.end_offset);
    const fStart = typeof start === 'number' ? start : `'${start}'`;
    const fEnd = typeof adjustedEnd === 'number' ? adjustedEnd : `'${adjustedEnd}'`;

    if (opts.end_offset) {
      const prefix = actualFieldName ? `${actualFieldName}` : '';
      return `${prefix}>=${fStart} AND ${prefix}<${fEnd}`;
    } else {
      const prefix = actualFieldName ? `${actualFieldName} BETWEEN ` : 'BETWEEN ';
      return `${prefix}${fStart} AND ${fEnd}`;
    }
  }
  return '1=1';
});







// Jinja template işleme fonksiyonu
export function processJinjaTemplate(sqlQuery: string, variables: Variable[]): { processedQuery: string; replacements: Record<string, string>; missingVariables: { name: string; label: string; required: boolean }[] } {
  const context: Record<string, any> = {
    now: format(new Date(), "yyyyMMdd")
  }

  const replacements: Record<string, string> = {}
  const missingVariables: { name: string; label: string; required: boolean }[] = []

  // Değişkenleri Nunjucks context'ine hazırla
  variables.forEach(variable => {
    const activeValue = variable.value || variable.defaultValue

    if (activeValue || variable.filterType === "between") {
      let rawVal: any = activeValue
      let sqlVal = ""

      // Tip dönüşümü: Sayı ise gerçek number tipine çevir
      const processValueType = (v: any) => {
        if (v === undefined || v === null || v === "") return v;
        if (variable.type === "number") {
          const num = Number(v);
          return isNaN(num) ? v : num;
        }
        return v;
      };

      if (variable.filterType === "between") {
        let betweenValues: { start: string, end: string } = { start: "", end: "" }
        if (variable.value) {
          try {
            const parsed = JSON.parse(variable.value)
            if (parsed && typeof parsed === 'object') {
              betweenValues.start = parsed.start || ""
              betweenValues.end = parsed.end || ""
            }
          } catch (e) { }
        }
        if ((!betweenValues.start || !betweenValues.end) && variable.defaultValue) {
          try {
            const defaultParsed = JSON.parse(variable.defaultValue)
            if (defaultParsed && typeof defaultParsed === 'object') {
              betweenValues.start = betweenValues.start || defaultParsed.start || ""
              betweenValues.end = betweenValues.end || defaultParsed.end || ""
            }
          } catch (e) { }
        }
        if (!betweenValues.start) betweenValues.start = variable.betweenStart || ""
        if (!betweenValues.end) betweenValues.end = variable.betweenEnd || ""


        const start = processValueType(betweenValues.start);
        const end = processValueType(betweenValues.end);

        rawVal = {
          start: start,
          end: end,
          begin: start,
          finish: end
        }

        const fStart = typeof start === 'number' ? start : `'${start}'`;
        const fEnd = typeof end === 'number' ? end : `'${end}'`;
        sqlVal = `${fStart} AND ${fEnd}`;

        context[`${variable.name}_BEGIN`] = fStart;
        context[`${variable.name}_END`] = fEnd;

      } else {
        const values = parseDefaultValues(activeValue)
        const typedValues = values.map(v => processValueType(v));

        if (typedValues.length > 1) {
          rawVal = typedValues
          const formatted = typedValues.map(v => typeof v === 'number' ? v : `'${v}'`);
          sqlVal = `(${formatted.join(", ")})`;
        } else if (typedValues.length === 1) {
          rawVal = typedValues[0]
          sqlVal = typeof rawVal === 'number' ? String(rawVal) : `'${rawVal}'`;

        } else {
          rawVal = ""
          sqlVal = "''"
        }
      }

      context[variable.name] = rawVal
      context[variable.name + '_sql'] = sqlVal
      replacements[variable.name] = String(sqlVal)

    } else if (variable.required) {
      missingVariables.push({ name: variable.name, label: variable.label, required: true })
    }
  })

  try {
    // Nunjucks (Jinja) etiketlerini akıllı filtrelere dönüştür
    // Hem {{ VAR('COL') | between }} hem de {{ VAR | between }} yazımlarını destekler.
    // Sadece SQL karşılaştırma filtrelerini (eq, ne, between vb.) hedef alır.
    const smartFilters = 'eq|ne|gt|lt|gte|ge|lte|le|like|between';
    const processedRawQuery = sqlQuery.replace(
      new RegExp(`\\{\\{\\s*(\\w+)(?:\\((['"]?)(.*?)\\2\\))?\\s*\\|\\s*(${smartFilters})(?:\\s*\\((.*?)\\))?(.*?)\\}\\}`, 'g'),
      (match, varName, q, colName, filterName, args, rest) => {
        const fieldName = colName || varName;
        const trimmedArgs = (args || '').trim();
        const trimmedRest = (rest || '').trim();

        // Filtreye gönderilecek argümanları inşa et
        let finalFilterArgs = `'${fieldName}'`;
        if (trimmedArgs) {
          finalFilterArgs += `, ${trimmedArgs}`;
        }

        return `{{ ${varName} | ${filterName}(${finalFilterArgs}) ${trimmedRest} }}`;
      }
    );







    const processedQuery = nunjucksEnv.renderString(processedRawQuery, context)

    return { processedQuery, replacements, missingVariables }
  } catch (error: any) {
    console.error("Nunjucks render error:", error)
    return {
      processedQuery: `/* TEMPLATE ERROR: ${error.message} */\n${sqlQuery}`,
      replacements,
      missingVariables
    }
  }
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

