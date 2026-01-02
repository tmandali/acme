"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Database, Plus, Search, Trash2, ArrowLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Connection {
    id: string
    name: string
    type: string
    connection_string: string
}

export default function ConnectionsPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [filter, setFilter] = useState("")

    useEffect(() => {
        fetchConnections()
    }, [])

    const fetchConnections = async () => {
        try {
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actionType: "list_connections" })
            })
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setConnections(data)
                }
            }
        } catch (e) {
            console.error("Failed to fetch connections", e)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`${name} bağlantısını silmek istediğinize emin misiniz?`)) return

        try {
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actionType: "delete_connection",
                    payload: { id }
                })
            })

            const data = await res.json()

            if (res.ok && !data.error) {
                toast.success("Bağlantı silindi")
                // Refresh list
                fetchConnections()
            } else {
                toast.error(`Hata: ${data.error || "Silinemedi"}`)
            }
        } catch (error) {
            console.error(error)
            toast.error("Bir hata oluştu")
        }
    }

    const filtered = connections.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.type.toLowerCase().includes(filter.toLowerCase())
    )

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="h-svh overflow-hidden flex flex-col">
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
                    <div className="flex flex-1 items-center gap-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <Link href="/sql-query" className="hover:text-foreground transition-colors">SQL Dashboard</Link>
                                </BreadcrumbItem>
                                <BreadcrumbItem>
                                    <Separator orientation="vertical" className="h-4 mx-2" />
                                </BreadcrumbItem>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-sm font-medium">Veritabanı Bağlantıları</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex-1 overflow-auto bg-muted/5">
                    <div className="max-w-5xl mx-auto px-6 py-12">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-light tracking-tight mb-2">Tanımlı Bağlantılar</h1>
                                <p className="text-sm text-muted-foreground">
                                    Sistemde kayıtlı veritabanı bağlantılarını yönetin.
                                </p>
                            </div>
                            <Button asChild>
                                <Link href="/sql-query/connections/new" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Yeni Bağlantı
                                </Link>
                            </Button>
                        </div>

                        <div className="bg-background border rounded-lg p-4 mb-6 flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Bağlantı ara..."
                                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-auto"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(conn => (
                                <div key={conn.id} className="group relative bg-card hover:bg-muted/50 border rounded-xl p-6 transition-all hover:shadow-sm">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Database className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            {!conn.id.toString().startsWith("sys_") && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        asChild
                                                    >
                                                        <Link href={`/sql-query/connections/${conn.id}`}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDelete(conn.id, conn.name)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="font-semibold text-lg mb-1">{conn.name}</h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                        <span className="px-2 py-0.5 rounded-full bg-muted border font-medium">
                                            {conn.type}
                                        </span>
                                        <span className="truncate max-w-[150px]" title={conn.connection_string}>
                                            {conn.connection_string}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">ID: {conn.id}</span>
                                    </div>
                                </div>
                            ))}

                            {/* Empty State */}
                            {filtered.length === 0 && (
                                <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-muted/10">
                                    <Database className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                                    <h3 className="font-medium text-lg mb-1">Bağlantı Bulunamadı</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Henüz bir veritabanı bağlantısı eklemediniz veya aramanızla eşleşen sonuç yok.</p>
                                    <Button variant="outline" asChild>
                                        <Link href="/sql-query/connections/new">
                                            İlk Bağlantıyı Ekle
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
