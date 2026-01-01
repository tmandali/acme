import { useRef, useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Play, Square, GripHorizontal } from "lucide-react"
import type { Schema } from "../lib/types"

// Ace Editor'ı dinamik olarak yükle (SSR desteği yok)
const AceEditor = dynamic(
  async () => {
    const ace = await import("react-ace")
    const aceBuilds = await import("ace-builds")
    await import("ace-builds/src-noconflict/mode-sql")
    await import("ace-builds/src-noconflict/theme-tomorrow_night")
    await import("ace-builds/src-noconflict/theme-tomorrow")
    await import("ace-builds/src-noconflict/ext-language_tools")

    // Ace'in global davranışını bozmadan dinamik şemayı desteklemek için bir referans tutuyoruz
    if (typeof window !== "undefined") {
      (window as any).__ACE_SCHEMA__ = null;
    }

    // SQL anahtar kelimeleri
    const sqlKeywords = [
      "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
      "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN",
      "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AS", "DISTINCT", "COUNT",
      "SUM", "AVG", "MIN", "MAX", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
      "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "INDEX", "PRIMARY KEY",
      "FOREIGN KEY", "REFERENCES", "NULL", "NOT NULL", "DEFAULT", "UNIQUE",
      "CHECK", "CONSTRAINT", "CASCADE", "UNION", "INTERSECT", "EXCEPT", "ALL",
      "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "COALESCE",
      "NULLIF", "TRUE", "FALSE", "ASC", "DESC", "IS", "IS NOT"
    ]

    // Nunjucks / Özel Filtreler ve Açıklamaları
    const filterDetails: Record<string, string> = {
      eq: "Eşitlik kontrolü. Boş değerlerde 'IS NULL', dizilerde 'IN (...)' üretir.",
      ne: "Eşitsizlik kontrolü. Boş değerlerde 'IS NOT NULL', dizilerde 'NOT IN (...)' üretir.",
      gt: "Büyüktür (>) kontrolü.",
      lt: "Küçüktür (<) kontrolü.",
      gte: "Büyük eşittir (>=) kontrolü.",
      ge: "Büyük eşittir (>=) kontrolü.",
      lte: "Küçük eşittir (<=) kontrolü.",
      le: "Küçük eşittir (<=) kontrolü.",
      like: "Benzerlik araması. Değeri '%değer%' formatına sokar.",
      between: "Başlangıç ve bitiş değerleri arasında (BETWEEN ... AND ...) filtreleme yapar. Opsiyonel 'end_offset' parametresi alabilir.",
      sql: "Değeri tipine göre formatlar. Sayı ise olduğu gibi, metin ise tırnaklı verir.",
      quote: "Değeri her zaman tek tırnak içine alır.",
      begin: "Aralık nesnesinin başlangıç (start) değerini döner.",
      start: "Aralık nesnesinin başlangıç (start) değerini döner.",
      end: "Aralık nesnesinin bitiş (end) değerini döner.",
      finish: "Aralık nesnesinin bitiş (end) değerini döner."
    }
    const customFilters = Object.keys(filterDetails)

    const keywordDetails: Record<string, string> = {
      if: "Koşullu mantık başlatır.",
      else: "Koşul sağlanmadığında çalışacak blok.",
      elif: "Alternatif koşul.",
      endif: "Koşullu mantık bloğunu kapatır.",
      for: "Döngü başlatır (Örn: for item in list).",
      in: "Döngü veya aidiyet kontrolü.",
      endfor: "Döngü bloğunu kapatır.",
      set: "Değişken tanımlar (Örn: set var = 'değer').",
      now: "Sistemin şu anki tarihini (yyyyMMdd) döner."
    }
    const nunjucksKeywords = Object.keys(keywordDetails)

    // Custom completer ekle
    const customCompleter = {
      getCompletions: (
        _editor: any,
        _session: any,
        _pos: any,
        _prefix: string,
        callback: (error: null, completions: any[]) => void
      ) => {
        const currentSchema = (window as any).__ACE_SCHEMA__ as Schema | null;

        let dynamicTables: any[] = [];
        let dynamicColumns: any[] = [];

        if (currentSchema && currentSchema.tables) {
          currentSchema.tables.forEach((table) => {
            dynamicTables.push({
              caption: table.name,
              value: table.name,
              meta: "table",
              score: 950
            });

            table.columns.forEach((col) => {
              dynamicColumns.push({
                caption: col.name,
                value: col.name,
                meta: `${table.name} column`,
                score: 850,
                docHTML: `<b>${col.name}</b> (${col.type})<br/>Table: ${table.name}`
              });
            });
          });
        }

        const completions = [
          ...sqlKeywords.map(kw => ({
            caption: kw,
            value: kw,
            meta: "keyword",
            score: 1000
          })),
          ...dynamicTables,
          ...dynamicColumns,
          ...customFilters.map(f => ({
            caption: f,
            value: f,
            meta: "filter",
            score: 1100,
            docHTML: `<b>${f}</b><hr/>${filterDetails[f]}`
          })),
          ...nunjucksKeywords.map(k => ({
            caption: k,
            value: k,
            meta: "nunjucks",
            score: 1050,
            docHTML: `<b>${k}</b><hr/>${keywordDetails[k]}`
          }))
        ]

        callback(null, completions)
      }
    }

    // SQL modunu Nunjucks için genişlet
    const SqlMode = aceBuilds.require("ace/mode/sql").Mode;
    const SqlHighlightRules = aceBuilds.require("ace/mode/sql_highlight_rules").SqlHighlightRules;
    const oop = aceBuilds.require("ace/lib/oop");

    const CustomSqlHighlightRules = function (this: any) {
      this.$rules = new SqlHighlightRules().getRules();

      // Jinja/Nunjucks etiketleri için kurallar
      const jinjaRules = [
        {
          token: "variable.language", // {{ }} ve {% %} için
          regex: "\\{\\{|\\}\\}|\\{%|%\\}"
        },
        {
          token: "support.function", // Özel filtreler için
          regex: "\\b(" + customFilters.join("|") + ")\\b"
        },
        {
          token: "keyword.control", // Nunjucks anahtar kelimeleri
          regex: "\\b(" + nunjucksKeywords.join("|") + ")\\b"
        }
      ];

      // Her state'in başına bu kuralları ekle (Özellikle "start")
      for (const state in this.$rules) {
        this.$rules[state].unshift(...jinjaRules);
      }
    };
    oop.inherits(CustomSqlHighlightRules, SqlHighlightRules);

    // Custom Folding Mode 
    const SqlFoldMode = new SqlMode().foldingRules ? new SqlMode().foldingRules.constructor : aceBuilds.require("ace/mode/folding/fold_mode").FoldMode;
    const Range = aceBuilds.require("ace/range").Range;

    const CustomFoldMode = function (this: any) {
      if (SqlFoldMode) {
        SqlFoldMode.call(this);
      }
    };
    oop.inherits(CustomFoldMode, SqlFoldMode);

    (function (this: any) {
      this.getFoldWidget = function (session: any, foldStyle: any, row: any) {
        const line = session.getLine(row);

        // Jinja Start Check
        if (/\{%\s*(python|reader)\b/.test(line)) {
          if (!/\{%\s*end(python|reader)\b/.test(line)) {
            return "start";
          }
        }

        // Jinja End Check
        if (/\{%\s*end(python|reader)\b/.test(line)) {
          return "end";
        }

        // SQL Statement Start Check (Top-level only heuristic)
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|TRUNCATE)\b/i.test(line)) {
          // Check if it's a single line statement (ends with semicolon on the same line)
          // This prevents folding arrows for one-liners like "SELECT * FROM table;"
          const tokens = session.getTokens(row);
          for (const token of tokens) {
            if (token.value === ";") {
              if (!token.type.includes("comment") && !token.type.includes("string")) {
                return "";
              }
            }
          }
          return "start";
        }

        // Fallback to parent
        if (SqlFoldMode.prototype.getFoldWidget) {
          return SqlFoldMode.prototype.getFoldWidget.call(this, session, foldStyle, row);
        }
        return "";
      };

      this.getFoldWidgetRange = function (session: any, foldStyle: any, row: any, forceMultiline: any) {
        const line = session.getLine(row);

        // 1. Jinja Block Folding
        const match = line.match(/\{%\s*(python|reader)\b/);

        if (match) {
          const tagName = match[1];
          const endTagRegex = new RegExp(`\\{%\\s*end${tagName}\\b`);

          let depth = 1;
          const maxRow = session.getLength();

          for (let i = row + 1; i < maxRow; i++) {
            const l = session.getLine(i);
            if (new RegExp(`\\{%\\s*${tagName}\\b`).test(l)) {
              depth++;
            }
            if (endTagRegex.test(l)) {
              depth--;
              if (depth === 0) {
                const endTagPos = l.search(endTagRegex);
                // Fold from end of start line to beginning of end tag
                return new Range(row, line.length, i, endTagPos);
              }
            }
          }
        }

        // 2. SQL Statement Folding
        const sqlMatch = line.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|TRUNCATE)\b/i);
        if (sqlMatch && !line.trim().startsWith("{%")) {
          const maxRow = session.getLength();
          let endRow = -1;
          let endCol = -1;

          outerLoop:
          for (let i = row; i < maxRow; i++) {
            const tokens = session.getTokens(i);
            let col = 0;
            for (const token of tokens) {
              const val = token.value;
              if (val === ";") {
                const type = token.type;
                if (type.indexOf("comment") === -1 && type.indexOf("string") === -1) {
                  endRow = i;
                  endCol = col + val.length;
                  break outerLoop;
                }
              }
              col += val.length;
            }
          }

          // If no semicolon found, fold to end of file
          if (endRow === -1) {
            endRow = maxRow - 1;
            endCol = session.getLine(endRow).length;
          }

          // Prevent folding if range is invalid or empty
          if (endRow > row || (endRow === row && endCol > line.length)) {
            return new Range(row, line.length, endRow, endCol);
          }
        }

        if (SqlFoldMode.prototype.getFoldWidgetRange) {
          return SqlFoldMode.prototype.getFoldWidgetRange.call(this, session, foldStyle, row, forceMultiline);
        }
        return null;
      };
    }).call(CustomFoldMode.prototype);

    const CustomSqlMode = function (this: any) {
      SqlMode.call(this);
      this.HighlightRules = CustomSqlHighlightRules;
      this.foldingRules = new (CustomFoldMode as any)();
    };
    oop.inherits(CustomSqlMode, SqlMode);

    // Ace'e yeni modu tanıt
    ; (aceBuilds as any).define("ace/mode/sql_nunjucks", ["require", "exports", "module"], (require: any, exports: any) => {
      exports.Mode = CustomSqlMode;
    });


    // Completer'ı ekle
    const langTools = aceBuilds.require("ace/ext/language_tools")
    langTools.setCompleters([
      langTools.snippetCompleter,
      langTools.keyWordCompleter,
      customCompleter
    ])


    return ace
  },
  { ssr: false }
)

// Export interfaces
export interface SQLEditorRef {
  focus: () => void;
}

interface SQLEditorProps {
  query: string
  onQueryChange: (query: string) => void
  onRunQuery: (queryToRun?: string) => void
  onCancelQuery: () => void
  isLoading: boolean
  isDarkMode: boolean
  editorHeight: number
  isResizing: boolean
  onResizeStart: (e: React.MouseEvent) => void
  schema: Schema
  readOnly?: boolean
}

import { forwardRef, useImperativeHandle } from "react"

export const SQLEditor = forwardRef<SQLEditorRef, SQLEditorProps>(function SQLEditor({
  query,
  onQueryChange,
  onRunQuery,
  onCancelQuery,
  isLoading,
  isDarkMode,
  editorHeight,
  isResizing,
  onResizeStart,
  schema,
  readOnly = false,
}, ref) {
  const [editorLoaded, setEditorLoaded] = useState(false)
  const editorInstanceRef = useRef<any>(null)

  // Use a ref to store the latest query for the gutter click handler
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.focus()
      }
    }
  }))

  // Helper to find block range (reusing logic conceptually from FoldMode)
  const getBlockRange = (session: any, row: number) => {
    const line = session.getLine(row);
    let startRow = row;
    let endRow = row;

    // 1. Jinja Block
    const jinjaMatch = line.match(/\{%\s*(python|reader)\b/);
    if (jinjaMatch) {
      const tagName = jinjaMatch[1];
      const endTagRegex = new RegExp(`\\{%\\s*end${tagName}\\b`);
      let depth = 1;
      for (let i = row + 1; i < session.getLength(); i++) {
        const l = session.getLine(i);
        if (new RegExp(`\\{%\\s*${tagName}\\b`).test(l)) depth++;
        if (endTagRegex.test(l)) {
          depth--;
          if (depth === 0) {
            endRow = i;
            return { start: startRow, end: endRow };
          }
        }
      }
      return { start: startRow, end: session.getLength() - 1 }; // Fallback
    }

    // 2. SQL Block
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|TRUNCATE)\b/i.test(line)) {
      // Scan for semicolon
      for (let i = row; i < session.getLength(); i++) {
        const tokens = session.getTokens(i);
        for (const token of tokens) {
          if (token.value === ";") {
            if (!token.type.includes("comment") && !token.type.includes("string")) {
              endRow = i;
              return { start: startRow, end: endRow };
            }
          }
        }
      }
      return { start: startRow, end: session.getLength() - 1 };
    }

    return null;
  };

  // Decoration logic
  const updateDecorations = useCallback(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const session = editor.getSession();
    const len = session.getLength();

    // Clear existing decorations
    for (let i = 0; i < len; i++) {
      session.removeGutterDecoration(i, "ace_runnable_line");
    }

    for (let i = 0; i < len; i++) {
      const line = session.getLine(i);
      let isRunnable = false;

      // Jinja Check
      if (/\{%\s*(python|reader)\b/.test(line) && !/\{%\s*end(python|reader)\b/.test(line)) {
        isRunnable = true;
      }
      // SQL Check
      else if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|TRUNCATE)\b/i.test(line)) {
        // Check if single line with semicolon (skip decoration if we want, or keep it?)
        // User 'tek satır ise katlama bloğu yok' dedi, but for running it might be useful?
        // Let's allow running even single lines for convenience.
        isRunnable = true;
      }

      if (isRunnable) {
        session.addGutterDecoration(i, "ace_runnable_line");
      }
    }
  }, []);

  // Gutter Click Handler
  const onGutterClick = useCallback((e: any) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    let target = e.domEvent.target;

    // If text node, move up to parent
    if (target.nodeType === 3) target = target.parentNode;

    // Ignore clicks on fold widgets (let them toggle fold)
    if (target.classList.contains("ace_fold-widget")) return;

    // Check if we are inside a gutter cell
    const cell = target.closest(".ace_gutter-cell");
    if (!cell) return;

    // Check if it's our runnable line
    if (!cell.classList.contains("ace_runnable_line")) return;

    // Removed isFocused check to ensure click always works

    const row = e.getDocumentPosition().row;
    const session = editor.getSession();

    const range = getBlockRange(session, row);
    if (range) {
      const lines = session.getLines(range.start, range.end);
      const blockContent = lines.join("\n");
      if (blockContent.trim()) {
        onRunQuery(blockContent);
        e.stop(); // Prevent default breakpoint toggling etc.
      }
    }
  }, [onRunQuery]);

  useEffect(() => {
    updateDecorations();
  }, [query, updateDecorations]);

  // Bind gutter click event listener dynamically to handle prop updates (like active connection)
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    editor.on("guttermousedown", onGutterClick);
    return () => {
      editor.off("guttermousedown", onGutterClick);
    };
  }, [onGutterClick, editorLoaded]);


  // Update the global schema reference for the Ace completer
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__ACE_SCHEMA__ = schema;
    }
  }, [schema])

  const handleExecute = useCallback(() => {
    let queryToRun = ""

    // Güvenilir içerik kaynağı olarak her zaman doğrudan editör instance'ını kullan
    if (editorInstanceRef.current) {
      const selectedText = editorInstanceRef.current.getSelectedText()
      if (selectedText && selectedText.trim().length > 0) {
        queryToRun = selectedText
      } else {
        // Eğer seçim yoksa, tüm içeriği doğrudan editörden al
        // (prop olan 'query' bayat (stale) olabilir)
        queryToRun = editorInstanceRef.current.getValue()
      }
    } else {
      // Yedek durum
      queryToRun = query
    }

    if (!queryToRun || !queryToRun.trim()) {
      return
    }

    onRunQuery(queryToRun)
  }, [query, onRunQuery, readOnly])


  // handleExecute fonksiyonunu bir ref içinde tutuyoruz ki Ace Editor command'i her zaman en güncel versiyonu çalıştırsın
  const handleExecuteRef = useRef(handleExecute)
  useEffect(() => {
    handleExecuteRef.current = handleExecute
  }, [handleExecute])

  return (
    <>
      {/* SQL Editor */}
      <div className="relative" style={{ height: editorHeight }}>
        <AceEditor
          onLoad={(editor) => {
            editorInstanceRef.current = editor
            updateDecorations();
            setEditorLoaded(true);
          }}
          mode="sql_nunjucks"


          theme={isDarkMode ? "tomorrow_night" : "tomorrow"}
          onChange={onQueryChange}
          value={query}
          name="sql-editor"
          width="100%"
          height="100%"
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          readOnly={readOnly}
          focus={true}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            fontFamily: "var(--font-geist-mono), monospace",
            readOnly: readOnly,
          }}
          commands={[
            {
              name: 'runQuery',
              bindKey: { win: 'Alt-Enter', mac: 'Option-Enter' },
              exec: () => handleExecuteRef.current()
            }
          ]}
          style={{
            background: "transparent",
          }}
        />

        <style jsx global>{`
          .ace_gutter-cell.ace_runnable_line {
             background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23059669'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E");
             background-repeat: no-repeat;
             background-position: 4px center;
             background-size: 14px;
             cursor: pointer;
          }
          .ace_gutter-cell.ace_runnable_line:hover {
             background-color: rgba(16, 185, 129, 0.15) !important;
             border-left: 2px solid #059669;
          }
        `}</style>

        {/* Run / Cancel Button */}
        <div className="absolute right-4 bottom-4">
          <Button
            onClick={isLoading ? onCancelQuery : handleExecute}
            size="icon"
            disabled={!isLoading && !query.trim()}
            className={`h-10 w-10 rounded-full text-white shadow-lg transition-all ${isLoading
              ? "bg-red-600 hover:bg-red-700"
              : !query.trim()
                ? "bg-gray-400 cursor-not-allowed opacity-50"
                : "bg-emerald-600 hover:bg-emerald-700"
              }`}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        className={`
              h-2 border-y bg-muted/30 cursor-row-resize flex items-center justify-center
              hover:bg-muted/50 transition-colors
              ${isResizing ? 'bg-muted/50' : ''}
            `}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground/50" />
      </div>
    </>
  )
})

