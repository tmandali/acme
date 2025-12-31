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
  // Arrow specific types
  Utf8: { icon: Type, color: "text-blue-500" },
  Int32: { icon: Hash, color: "text-amber-500" },
  Int64: { icon: Key, color: "text-amber-500" },
  Float64: { icon: Hash, color: "text-orange-500" },
  Date32: { icon: Calendar, color: "text-emerald-500" },
  Date64: { icon: Calendar, color: "text-emerald-500" },
  Timestamp: { icon: Clock, color: "text-emerald-500" },
}


// Re-usable variables to ignore (Built-in keywords or globals)
export const IGNORED_KEYWORDS = new Set([
  'if', 'else', 'elif', 'endif', 'for', 'in', 'endfor',
  'set', 'filter', 'endfilter', 'macro', 'endmacro',
  'include', 'import', 'extends', 'block', 'endblock',
  'and', 'or', 'not', 'true', 'false', 'null', 'none',
  'now', 'loop', 'range', 'item'
])

export function findVariablesInQuery(query: string): string[] {
  if (typeof query !== 'string') return []

  const foundVariables: string[] = []

  // 1. {{ ... }} içindeki değişkenleri bul (Fonksiyonel kolon ismi ve filtre argümanları desteği ile)
  // Örn: {{ VAR('COL') | between(offset=1) }}
  const expressionMatches = query.matchAll(/\{\{\s*([\w.]+)(?:\((?:['"]?)(.*?)(?:['"]?)\))?(?:\s*\|\s*[\w]+(?:\(.*?\))?)*\s*\}\}/g)

  for (const match of expressionMatches) {
    // match[1] değişken adını, match[2] ise opsiyonel kolon adını yakalar
    const baseVar = match[1].split('.')[0]
    if (baseVar && !IGNORED_KEYWORDS.has(baseVar) && !foundVariables.includes(baseVar)) {
      foundVariables.push(baseVar)
    }
  }

  // 2. {% ... %} içindeki değişkenleri bul (if, elif, for in)
  const tagMatches = query.matchAll(/\{%\s*(?:if|elif|for|set)\s+([^%]+)%}/g)
  for (const match of tagMatches) {
    const content = match[1]
    // İçerikteki kelimeleri ayır ve değişken olabilecekleri bul
    // Örn: "user == 'admin'", "item in items"
    const words = content.match(/\b[a-zA-Z_]\w*\b/g) || []
    for (const word of words) {
      if (word && !IGNORED_KEYWORDS.has(word) && !foundVariables.includes(word)) {
        foundVariables.push(word)
      }
    }
  }

  return foundVariables
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
  // Handle complex types like Timestamp(Nanosecond, None)
  const baseType = type.split('(')[0]
  return columnTypeConfig[baseType] || columnTypeConfig[type] || { icon: Circle, color: "text-muted-foreground" }
}

// Nunjucks ortamını yapılandır
const nunjucksEnv = nunjucks.configure({ autoescape: false });


// SQL için özel filtreler ekle
const quoteFunc = (val: any) => {
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) return val.map(v => typeof v === 'number' ? v : `'${v}'`).join(', ');
  return `'${val}'`;
};
nunjucksEnv.addFilter('quote', quoteFunc);
nunjucksEnv.addGlobal('quote', quoteFunc);


const sqlFunc = (val: any) => {
  if (val === undefined || val === null || val === '') return 'NULL';
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) {
    const joined = val.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
    return `(${joined})`;
  }
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${val}'`;
};
nunjucksEnv.addFilter('sql', sqlFunc);
nunjucksEnv.addGlobal('sql', sqlFunc);

// Reader etiketi için dummy extension (Frontend tarafında hata almamak için)
class ReaderExtension {
  tags = ['reader'];
  parse(parser: any, nodes: any) {
    const tok = parser.nextToken();

    // Argümanları parse etmek yerine, blok bitimine kadar olan her şeyi tüket.
    // Bu, frontend'in 'string' veya 'int' dışındaki karmaşık argümanlarda (örn. pathler) 
    // hata vermesini engeller.
    let peek = parser.peekToken();
    // NOT: Nunjucks versiyonuna göre 'block-end' veya 'block_end' olabilir.
    while (peek && peek.type !== 'block_end' && peek.type !== 'block-end') {
      parser.nextToken();
      peek = parser.peekToken();
    }

    // Blok bitişini (%}) manual olarak tüket
    if (peek && (peek.type === 'block_end' || peek.type === 'block-end')) {
      parser.nextToken();
    }

    // parser.advanceAfterBlockEnd(tok.value) çağrısını atlıyoruz çünkü manual tükettik.

    const body = parser.parseUntilBlocks('endreader');
    parser.advanceAfterBlockEnd();
    return new nodes.CallExtension(this, 'run', null, [body]);
  }
  run(_context: any) {
    return ""; // Frontend'de içeriği gösterme (Backend'de işlenecek)
  }
}
(nunjucksEnv as any).addExtension('ReaderExtension', new ReaderExtension());

// Değerin bir aralık nesnesi olup olmadığını kontrol et
const isRange = (val: any) => val && typeof val === 'object' && ('start' in val || 'begin' in val);

// Aralığın parçalarına erişim
const beginFunc = (val: any) => isRange(val) ? (val.begin || val.start) : val;
const startFunc = (val: any) => isRange(val) ? (val.start || val.begin) : val;
const endFunc = (val: any) => isRange(val) ? (val.finish || val.end) : val;
const finishFunc = (val: any) => isRange(val) ? (val.finish || val.end) : val;

nunjucksEnv.addFilter('begin', beginFunc);
nunjucksEnv.addGlobal('begin', beginFunc);
nunjucksEnv.addFilter('start', startFunc);
nunjucksEnv.addGlobal('start', startFunc);
nunjucksEnv.addFilter('end', endFunc);
nunjucksEnv.addGlobal('end', endFunc);
nunjucksEnv.addFilter('finish', finishFunc);
nunjucksEnv.addGlobal('finish', finishFunc);

// Tarih aritmetiği filtresi (örn: {{ now | add_days(-1) }})
nunjucksEnv.addFilter('add_days', (val: any, days: number) => {
  if (!val) return val;
  const dateStr = String(val);
  const d = dateStr.length === 8
    ? parse(dateStr, "yyyyMMdd", new Date())
    : new Date(dateStr);
  if (!isValid(d)) return val;
  return format(addDays(d, Number(days)), "yyyyMMdd");
});

// Şablon ve Bağıl Tarih Değerlerini Çözen Fonksiyon
export function evaluateTemplateValue(v: any, nowStr?: string): string {
  if (v === undefined || v === null || v === "") return v;
  if (typeof v !== 'string') return String(v);

  const now = nowStr || format(new Date(), "yyyyMMdd");
  let processed = v;

  // 1. Template render et (örn: {{now}})
  if (v.includes('{{')) {
    try {
      processed = nunjucksEnv.renderString(v, { now });
    } catch (e) {
      console.error("Value render error:", e);
    }
  }

  // 2. Bağıl tarih hesapla (örn: 20241224 -1d)
  const relativeMatch = processed.trim().match(/^(\d{8})\s*([+-])\s*(\d+)([dmwy])$/);
  if (relativeMatch) {
    const [_, baseDate, op, amount, unit] = relativeMatch;
    const d = parse(baseDate, "yyyyMMdd", new Date());
    if (isValid(d)) {
      let days = Number(amount);
      if (op === '-') days = -days;

      if (unit === 'd') {
        processed = format(addDays(d, days), "yyyyMMdd");
      } else if (unit === 'w') {
        processed = format(addDays(d, days * 7), "yyyyMMdd");
      } else if (unit === 'm') {
        processed = format(addDays(d, days * 30), "yyyyMMdd");
      }
    }
  }

  return processed;
}

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

const getValAndField = (val: any, fieldName?: string) => {
  // 1. Eğer fonksiyon çağrısı yapıldıysa (örn: VAR('COL'))
  if (val && typeof val === 'object' && val.__isSqlWrapper) {
    return { v: val.value, f: val.fieldName || fieldName, empty: val.emptyValue };
  }
  // 2. Eğer direkt değişken geçildiyse (örn: VAR | eq)
  if (typeof val === 'function' && (val as any).__isSqlFunction) {
    const executed = val();
    return { v: executed.value, f: executed.fieldName || fieldName, empty: (val as any).emptyValue };
  }
  // 3. Standart değer
  return { v: val, f: fieldName, empty: undefined };
};

const resolveEmptyValue = (f: string | undefined, emptyValTemplate: string | undefined, defaultSql: string) => {
  if (!emptyValTemplate) return defaultSql;
  // {{ field }} etiketini kolon ismiyle değiştir
  return emptyValTemplate.replace(/\{\{\s*field\s*\}\}/g, f || '');
};

// > Greater Than
const gtFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  const formatted = formatSqlValue(v);
  if (formatted === null) return resolveEmptyValue(f, empty, '');
  const prefix = f ? `${f} > ` : '> ';
  return `${prefix}${formatted}`;
};
nunjucksEnv.addFilter('gt', gtFunc);
nunjucksEnv.addGlobal('gt', gtFunc);

// < Less Than
const ltFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  const formatted = formatSqlValue(v);
  if (formatted === null) return resolveEmptyValue(f, empty, '');
  const prefix = f ? `${f} < ` : '< ';
  return `${prefix}${formatted}`;
};
nunjucksEnv.addFilter('lt', ltFunc);
nunjucksEnv.addGlobal('lt', ltFunc);

// >= Greater Than or Equal To
const gteFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  const formatted = formatSqlValue(v);
  if (formatted === null) return resolveEmptyValue(f, empty, '');
  const prefix = f ? `${f} >= ` : '>= ';
  return `${prefix}${formatted}`;
};
nunjucksEnv.addFilter('gte', gteFunc);
nunjucksEnv.addGlobal('gte', gteFunc);
nunjucksEnv.addFilter('ge', gteFunc);
nunjucksEnv.addGlobal('ge', gteFunc);

// <= Less Than or Equal To
const lteFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  const formatted = formatSqlValue(v);
  if (formatted === null) return resolveEmptyValue(f, empty, '');
  const prefix = f ? `${f} <= ` : '<= ';
  return `${prefix}${formatted}`;
};
nunjucksEnv.addFilter('lte', lteFunc);
nunjucksEnv.addGlobal('lte', lteFunc);
nunjucksEnv.addFilter('le', lteFunc);
nunjucksEnv.addGlobal('le', lteFunc);


// == Equal (Smart: handles null and IN)
const eqFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  if (v === undefined || v === null || v === '') {
    return resolveEmptyValue(f, empty, '');
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return resolveEmptyValue(f, empty, '');
    const joined = v.map(item => typeof item === 'number' ? item : `'${item}'`).join(', ');
    return f ? `${f} IN (${joined})` : `IN (${joined})`;
  }
  const formatted = formatSqlValue(v);
  return f ? `${f} = ${formatted}` : `= ${formatted}`;
};
nunjucksEnv.addFilter('eq', eqFunc);
nunjucksEnv.addGlobal('eq', eqFunc);


// != Not Equal
const neFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  if (v === undefined || v === null || v === '') {
    return resolveEmptyValue(f, empty, '');
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return resolveEmptyValue(f, empty, '');
    const joined = v.map(item => typeof item === 'number' ? item : `'${item}'`).join(', ');
    return f ? `${f} NOT IN (${joined})` : `NOT IN (${joined})`;
  }
  const formatted = formatSqlValue(v);
  return f ? `${f} <> ${formatted}` : `<> ${formatted}`;
};
nunjucksEnv.addFilter('ne', neFunc);
nunjucksEnv.addGlobal('ne', neFunc);


// Benzer şekilde LIKE için
const likeFunc = (val: any, fieldName?: string) => {
  const { v, f, empty } = getValAndField(val, fieldName);
  if (v === undefined || v === null || v === '') return resolveEmptyValue(f, empty, '');
  return f ? `${f} LIKE '%${v}%'` : `LIKE '%${v}%'`;
};
nunjucksEnv.addFilter('like', likeFunc);
nunjucksEnv.addGlobal('like', likeFunc);


// BETWEEN filtresi: Aralık nesnesini alır ve BETWEEN 'start' AND 'end' üretir.
// end_offset parametresi eklenirse range gibi davranır (>= ve < kullanır)
const betweenFunc = function (val: any, fieldName?: any, options?: any) {
  const { v, f, empty } = getValAndField(val, typeof fieldName === 'string' ? fieldName : undefined);
  let opts = (typeof fieldName === 'object' ? fieldName : options) || {};

  if (v && typeof v === 'object' && ('start' in v || 'begin' in v)) {
    const start = v.start || v.begin;
    const end = v.finish || v.end;

    if (!start && !end) return resolveEmptyValue(f, empty, '');

    const adjustedEnd = getAdjustedEndValue(end, opts.end_offset);
    const fStart = typeof start === 'number' ? start : `'${start}'`;
    const fEnd = typeof adjustedEnd === 'number' ? adjustedEnd : `'${adjustedEnd}'`;

    if (opts.end_offset) {
      const prefix = f ? `${f}` : '';
      return `${prefix}>=${fStart} AND ${prefix}<${fEnd}`;
    } else {
      const prefix = f ? `${f} BETWEEN ` : 'BETWEEN ';
      return `${prefix}${fStart} AND ${fEnd}`;
    }
  }
  return resolveEmptyValue(f, empty, '');
};
nunjucksEnv.addFilter('between', betweenFunc);
nunjucksEnv.addGlobal('between', betweenFunc);







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

    // Değişken her zaman context'e eklenmeli (boş olsa bile emptyValue çalışması için)
    const createSqlWrapper = (val: any, sqlValue: string, defaultName: string, emptyVal: string | undefined) => {
      const wrapper = (fieldName?: string) => {
        return {
          __isSqlWrapper: true,
          value: val,
          fieldName: fieldName || defaultName,
          emptyValue: emptyVal
        };
      };

      // Bu flag filtreler tarafından tanınmasını sağlar
      (wrapper as any).__isSqlFunction = true;
      (wrapper as any).emptyValue = emptyVal;

      // {{ VAR }} şeklinde direkt kullanıldığında SQL hazır değerini döner
      wrapper.toString = () => {
        if (!val || (Array.isArray(val) && val.length === 0)) {
          if (emptyVal) return resolveEmptyValue(defaultName, emptyVal, '');
        }
        return String(sqlValue);
      };

      return wrapper;
    };

    let rawVal: any = ""
    let sqlVal = ""

    if (activeValue || variable.filterType === "between") {
      // Tip dönüşümü ve Bağıl Tarih İşleme
      const processValueType = (v: any) => {
        const processed = evaluateTemplateValue(v, context.now);

        if (variable.type === "number") {
          const num = Number(processed);
          return isNaN(num) ? processed : num;
        }
        return processed;
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
        }
      }
    } else if (variable.required) {
      missingVariables.push({ name: variable.name, label: variable.label, required: true })
    }

    context[variable.name] = createSqlWrapper(rawVal, sqlVal, variable.name, variable.emptyValue);
    context[variable.name + '_sql'] = sqlVal
    replacements[variable.name] = String(sqlVal)
  })

  // 1. Render template - extremely defensive
  try {
    const res = nunjucksEnv.renderString(sqlQuery, context);
    return {
      processedQuery: res,
      replacements,
      missingVariables
    };
  } catch (renderError: any) {
    console.error("Critical Nunjucks Error:", renderError);

    let msg = "Template yazım hatası";
    if (renderError && renderError.message) {
      msg = renderError.message.replace(/\(unknown path\)\s*/g, '');
    }

    return {
      processedQuery: `/* TEMPLATE ERROR: ${msg} */\n${sqlQuery}`,
      replacements,
      missingVariables
    };
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

