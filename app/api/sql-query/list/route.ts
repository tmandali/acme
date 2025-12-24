import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { QueryFile } from "@/app/sql-query/lib/types"

export async function GET() {
  try {
    const queryDir = path.join(process.cwd(), "app/sql-query/query")
    
    // Klasör yoksa boş dizi döndür
    if (!fs.existsSync(queryDir)) {
      return NextResponse.json({ queries: [] })
    }

    const files = fs.readdirSync(queryDir)
    const yamlFiles = files.filter(file => file.endsWith(".yaml") || file.endsWith(".yml"))

    const queries = yamlFiles.map(file => {
      try {
        const filePath = path.join(queryDir, file)
        const fileContent = fs.readFileSync(filePath, "utf8")
        const parsedData = yaml.load(fileContent) as QueryFile
        
        // Slug'ı dosya adından al (uzantı olmadan)
        const slug = file.replace(/\.(yaml|yml)$/, "")
        
        return {
          slug,
          name: parsedData.name || slug,
          sql: parsedData.sql || "",
          variablesCount: parsedData.variables?.length || 0,
          createdAt: fs.statSync(filePath).mtime.toISOString(),
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error)
        return null
      }
    }).filter(Boolean)

    return NextResponse.json({ queries })
  } catch (error) {
    console.error("Error listing queries:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
