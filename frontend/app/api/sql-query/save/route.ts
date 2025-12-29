
import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { QueryFile } from "@/app/sql-query/lib/types"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, sql, variables, slug, connectionId } = body

        if (!name || !sql || !variables) {
            return NextResponse.json({ error: "Missing required fields (name, sql, variables)" }, { status: 400 })
        }

        const queryDir = path.join(process.cwd(), "app/sql-query/query")

        // Ensure directory exists
        if (!fs.existsSync(queryDir)) {
            fs.mkdirSync(queryDir, { recursive: true })
        }

        let finalSlug = slug
        if (!finalSlug) {
            // Generate a random slug if not provided
            // Using a simple random string
            finalSlug = `query_${Math.random().toString(36).substring(2, 10)}`
        } else {
            // Validate slug if provided
            if (!/^[a-zA-Z0-9_\-]+$/.test(finalSlug)) {
                return NextResponse.json({ error: "Invalid slug format" }, { status: 400 })
            }
        }

        const filePath = path.join(queryDir, `${finalSlug}.yaml`)

        // Clean variables for saving (don't save active values)
        const cleanVariables = variables.map((v: any) => ({
            ...v,
            value: ""
        }))

        const queryFile: QueryFile = {
            name,
            sql,
            variables: cleanVariables,
            connectionId
        }

        const yamlContent = yaml.dump(queryFile, {
            indent: 2,
            lineWidth: -1,
            quotingType: '"',
            forceQuotes: false,
        })

        fs.writeFileSync(filePath, yamlContent, "utf8")

        return NextResponse.json({
            success: true,
            slug: finalSlug,
            message: "Sorgu başarıyla kaydedildi"
        })

    } catch (error) {
        console.error("Error saving query:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
