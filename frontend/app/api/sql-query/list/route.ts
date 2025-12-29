
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { QueryFile } from "@/app/sql-query/lib/types"

export async function GET() {
    try {
        const queryDir = path.join(process.cwd(), "app/sql-query/query")

        if (!fs.existsSync(queryDir)) {
            return NextResponse.json({ queries: [] })
        }

        const files = fs.readdirSync(queryDir)
        const queries = files
            .filter(file => file.endsWith(".yaml") || file.endsWith(".yml"))
            .map(file => {
                const filePath = path.join(queryDir, file)
                const content = fs.readFileSync(filePath, "utf8")
                try {
                    const parsed = yaml.load(content) as QueryFile
                    return {
                        slug: file.replace(/\.(yaml|yml)$/, ""),
                        name: parsed.name || file,
                        sql: parsed.sql || ""
                    }
                } catch (e) {
                    console.error(`Error parsing ${file}:`, e)
                    return null
                }
            })
            .filter(q => q !== null)

        return NextResponse.json({ queries })

    } catch (error) {
        console.error("Error listing queries:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
