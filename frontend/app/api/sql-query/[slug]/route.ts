
import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { processJinjaTemplate } from "@/app/sql-query/lib/utils"
import { sampleResults } from "@/app/sql-query/lib/data"
import { QueryFile, Variable } from "@/app/sql-query/lib/types"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    // 1. Validate slug
    if (!/^[a-zA-Z0-9_\-]+$/.test(slug)) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
    }

    // 2. Read YAML file
    const queryDir = path.join(process.cwd(), "app/sql-query/query")
    const filePath = path.join(queryDir, `${slug}.yaml`)

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Query not found" }, { status: 404 })
    }

    try {
        const fileContent = fs.readFileSync(filePath, "utf8")
        const parsedData = yaml.load(fileContent) as QueryFile
        const variables = parsedData.variables || []

        // 3. Parse Request Body
        let body = await request.json()

        // Support wrapping variables in a "variables" key
        if (body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables)) {
            body = body.variables
        }

        // 4. Map Body Values to Variables
        // The goal is to set variable.value so processJinjaTemplate can use it.
        const updatedVariables = variables.map((v) => {
            const incomingValue = body[v.name]

            if (incomingValue !== undefined) {

                if (v.filterType === "between" && typeof incomingValue === "object") {
                    // Handle { BEGIN: "...", END: "..." } -> { start: "...", end: "..." }
                    // Also support { start: "...", end: "..." } and { begin: "...", end: "..." }
                    const start = incomingValue.BEGIN || incomingValue.start || incomingValue.begin || ""
                    const end = incomingValue.END || incomingValue.end || ""
                    return {
                        ...v,
                        value: JSON.stringify({ start, end })
                    }
                }

                if (Array.isArray(incomingValue)) {
                    // Flatten array to JSON string for multi-select
                    return {
                        ...v,
                        value: JSON.stringify(incomingValue)
                    }
                }

                // Default: use value as string
                return {
                    ...v,
                    value: String(incomingValue)
                }
            }

            // No value provided, keep default or empty
            return v
        })

        // 5. Process Template
        const { processedQuery, missingVariables } = processJinjaTemplate(parsedData.sql, updatedVariables)

        // Identify missing required variables
        const allMissing = new Map<string, { name: string, label: string, type: string }>()

        // A) Variables that processJinjaTemplate couldn't resolve AND are marked required
        missingVariables.forEach(v => {
            if (v.required) {
                const originalVar = variables.find(ov => ov.name === v.name)
                allMissing.set(v.name, {
                    name: v.name,
                    label: v.label,
                    type: originalVar?.type || "unknown"
                })
            }
        })


        if (allMissing.size > 0) {
            const missingList = Array.from(allMissing.values())
            const missingLabels = missingList.map(v => v.label).join(", ")

            return NextResponse.json({
                error: "Zorunlu alanlar eksik",
                message: `Aşağıdaki zorunlu alanlar için değer sağlanmadı: ${missingLabels}. Lütfen bu alanları gönderilen JSON verisine ekleyin.`,
                missing_fields: missingList.map(v => {
                    return {
                        key: v.name,
                        label: v.label,
                        type: v.type
                    }
                })
            }, { status: 400 })
        }

        // 6. Return Mock Results (since we don't have real DB yet)
        // In a real app, we would execute processedQuery against DB here.

        return NextResponse.json({
            success: true,
            data: sampleResults,
            meta: {
                processed_sql: processedQuery,
                execution_time_ms: 42 // Mock time
            }
        })

    } catch (error) {
        console.error(`Error processing query ${slug}:`, error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
