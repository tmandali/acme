import { CopyButton } from "./copy-button"
import type { Variable } from "../lib/types"

interface ApiTabContentProps {
    slug?: string
    variables: Variable[]
}

export function ApiTabContent({ slug, variables }: ApiTabContentProps) {
    const renderVariables = (vars: Variable[]) => {
        return vars.map(v => {
            const val = v.value || v.defaultValue
            if (v.filterType === 'between') {
                // ... logic for between ...
                const formatDate = (d: any) => {
                    const s = String(d || "")
                    if (s && /^\d{8}$/.test(s)) {
                        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
                    }
                    return d || ""
                }

                let start = v.betweenStart || ""
                let end = v.betweenEnd || ""

                if (val) {
                    try {
                        const parsed = JSON.parse(val)
                        if (parsed && typeof parsed === 'object') {
                            start = parsed.start || parsed.begin || ""
                            end = parsed.end || parsed.finish || ""
                        }
                    } catch (e) { }
                }

                return `\n      "${v.name}_BEGIN": "${formatDate(start)}",` +
                    `\n      "${v.name}_END": "${formatDate(end)}"`
            }
            if (v.type === 'number') {
                return `\n      "${v.name}": ${val || 'null'}`
            }
            return `\n      "${v.name}": "${val}"`
        }).join(',')
    }

    return (
        <div className="p-4 overflow-auto bg-muted/10 font-mono text-xs flex-1 h-full">
            <div className="mb-4">
                <div className="relative group">
                    <div className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 rounded-md font-mono text-xs overflow-x-auto border border-zinc-200 dark:border-zinc-800">
                        POST http://localhost:3000/sql-query/{slug || 'api/execute'}
                    </div>
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton text={`POST http://localhost:3000/sql-query/${slug || 'api/execute'}`} />
                    </div>
                </div>
            </div>
            <div>
                <div>
                    <div className="font-semibold mb-2 text-muted-foreground">Example Request (cURL)</div>
                    <div className="relative group">
                        <pre className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 rounded-md font-mono text-xs overflow-x-auto whitespace-pre border border-zinc-200 dark:border-zinc-800">
                            <code>{`curl -X POST http://localhost:3000/sql-query/${slug || 'api/execute'} \\
  -H "Content-Type: application/json" \\
  -d '{
    "variables": {${renderVariables(variables)}
    }
  }'`}</code>
                        </pre>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyButton text={`curl -X POST http://localhost:3000/sql-query/${slug || 'api/execute'} ...`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
