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
import { Database, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NewConnectionPage() {
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
                                    <BreadcrumbPage className="text-sm font-medium">Yeni Bağlantı</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <main className="flex-1 overflow-auto bg-muted/5">
                    <div className="max-w-2xl mx-auto px-6 py-12">
                        <div className="mb-8">
                            <Button variant="ghost" size="sm" className="pl-0 gap-2 text-muted-foreground hover:text-foreground mb-4" asChild>
                                <Link href="/sql-query">
                                    <ArrowLeft className="h-4 w-4" />
                                    Geri Dön
                                </Link>
                            </Button>
                            <h1 className="text-2xl font-light tracking-tight mb-2">Yeni Veritabanı Bağlantısı</h1>
                            <p className="text-sm text-muted-foreground">
                                Sorgularınızda kullanmak üzere yeni bir veri kaynağı ekleyin.
                            </p>
                        </div>

                        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                            <div className="p-8 border-b bg-muted/30">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                    <Database className="h-6 w-6 text-primary" />
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    Bağlantı ayarları henüz yapılandırılmadı. Bu alan bir sonraki aşamada aktif edilecektir.
                                </p>
                            </div>
                            <div className="p-8 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bağlantı Adı</label>
                                    <input type="text" className="w-full h-10 px-3 bg-muted/50 border rounded-md outline-none focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm" placeholder="Örn: Production DB" disabled />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Veritabanı Tipi</label>
                                    <select className="w-full h-10 px-3 bg-muted/50 border rounded-md outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm appearance-none" disabled>
                                        <option>PostgreSQL</option>
                                        <option>MySQL</option>
                                        <option>BigQuery</option>
                                        <option>MSSQL</option>
                                    </select>
                                </div>
                                <Button className="w-full mt-4" disabled>Bağlantıyı Kaydet</Button>
                            </div>
                        </div>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
