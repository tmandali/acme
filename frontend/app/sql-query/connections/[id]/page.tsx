"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
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
import { Database, ArrowLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Connection {
    id: string
    name: string
    type: string
    connection_string: string
}

export default function EditConnectionPage() {
    const router = useRouter()
    const params = useParams()
    const { id } = params

    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(true)
    const [formData, setFormData] = useState({
        name: "",
        type: "PostgreSQL",
        connectionString: ""
    })

    useEffect(() => {
        fetchConnection()
    }, [])

    const fetchConnection = async () => {
        try {
            // Since we don't have get_connection, we list all and find
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actionType: "list_connections" })
            })
            if (res.ok) {
                const data: Connection[] = await res.json()
                const found = data.find(c => c.id === id)
                if (found) {
                    setFormData({
                        name: found.name,
                        type: found.type,
                        connectionString: found.connection_string
                    })
                } else {
                    toast.error("Bağlantı bulunamadı")
                    router.push("/sql-query/connections")
                }
            }
        } catch (e) {
            console.error("Failed to fetch connection", e)
            toast.error("Bağlantı blgileri alınamadı")
        } finally {
            setIsFetching(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.connectionString) {
            toast.error("Lütfen tüm alanları doldurun")
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch("/api/flight/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actionType: "save_connection",
                    payload: {
                        id: id,
                        name: formData.name,
                        type: formData.type,
                        connection_string: formData.connectionString
                    }
                })
            })

            const data = await res.json()

            if (res.ok && !data.error) {
                toast.success("Bağlantı başarıyla güncellendi")
                router.push("/sql-query/connections")
            } else {
                toast.error(`Hata: ${data.error || "Güncellenemedi"}`)
            }
        } catch (error) {
            console.error(error)
            toast.error("Bir hata oluştu")
        } finally {
            setIsLoading(false)
        }
    }

    if (isFetching) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

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
                                    <BreadcrumbPage className="text-sm font-medium">Bağlantıyı Düzenle</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex-1 overflow-auto bg-muted/5">
                    <div className="max-w-2xl mx-auto px-6 py-12">
                        <div className="mb-8">
                            <Button variant="ghost" size="sm" className="pl-0 gap-2 text-muted-foreground hover:text-foreground mb-4" asChild>
                                <Link href="/sql-query/connections">
                                    <ArrowLeft className="h-4 w-4" />
                                    Geri Dön
                                </Link>
                            </Button>
                            <h1 className="text-2xl font-light tracking-tight mb-2">Veritabanı Bağlantısını Düzenle</h1>
                            <p className="text-sm text-muted-foreground">
                                Mevcut bağlantı ayarlarını güncelleyin.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="bg-card border rounded-xl overflow-hidden shadow-sm">
                            <div className="p-8 border-b bg-muted/30">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                    <Database className="h-6 w-6 text-primary" />
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    Veritabanı bağlantı bilgilerinizi aşağıya giriniz.
                                </p>
                            </div>
                            <div className="p-8 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bağlantı Adı <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full h-10 px-3 bg-background border rounded-md outline-none focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                                        placeholder="Örn: Production DB"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Veritabanı Tipi</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full h-10 px-3 bg-background border rounded-md outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm appearance-none"
                                    >
                                        <option value="PostgreSQL">PostgreSQL</option>
                                        <option value="MySQL">MySQL</option>
                                        <option value="BigQuery">BigQuery</option>
                                        <option value="MSSQL">MSSQL</option>
                                        <option value="Oracle">Oracle</option>
                                        <option value="SQLite">SQLite</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connection String <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.connectionString}
                                        onChange={(e) => setFormData(prev => ({ ...prev, connectionString: e.target.value }))}
                                        className="w-full h-10 px-3 bg-background border rounded-md outline-none focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                                        placeholder="postgresql://user:pass@host:5432/dbname"
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full mt-4 gap-2" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {isLoading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
