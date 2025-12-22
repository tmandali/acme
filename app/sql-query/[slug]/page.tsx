import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { notFound } from "next/navigation"
import SQLQueryPageClient from "../components/sql-query-page-client"
import { QueryFile } from "../lib/types"

interface PageProps {
    params: Promise<{
        slug: string
    }>
}

export default async function QueryPage({ params }: PageProps) {
    const { slug } = await params

    // Security check: prevent directory traversal
    // Allow only alphanumeric, underscores, and dashes
    if (!/^[a-zA-Z0-9_\-]+$/.test(slug)) {
        notFound()
    }

    const queryDir = path.join(process.cwd(), "app/sql-query/query")
    const filePath = path.join(queryDir, `${slug}.yaml`)

    if (!fs.existsSync(filePath)) {
        notFound()
    }

    try {
        const fileContent = fs.readFileSync(filePath, "utf8")
        const parsedData = yaml.load(fileContent) as QueryFile

        // Ensure the data matches the expected structure slightly or at least has valid parts
        // We pass it to the client component which handles partial data gracefully

        return <SQLQueryPageClient initialData={parsedData} slug={slug} />
    } catch (error) {
        console.error(`Error loading query file ${slug}:`, error)
        // If file exists but fails to parse, we might want to show error or 404. 
        // For now, let's returning 404 or maybe a error page. 
        // Retrowing triggers error.tsx if exists.
        throw error
    }
}
