
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
// import { ScrollArea } from "@/components/ui/scroll-area" 
import { FileText, Trash2, Loader2, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface SavedQuery {
    slug: string
    name: string
    sql: string
}

export function SavedQueriesList() {
    const [queries, setQueries] = useState<SavedQuery[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const fetchQueries = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/sql-query/list")
            if (res.ok) {
                const data = await res.json()
                setQueries(data.queries || [])
            }
        } catch (error) {
            console.error("Failed to fetch queries", error)
            toast.error("Sorgular yüklenirken hata oluştu")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchQueries()
        }
    }, [open])

    const handleDelete = async (slug: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(`'${name}' sorgusunu silmek istediğinize emin misiniz?`)) return

        try {
            const res = await fetch(`/api/sql-query/${slug}`, {
                method: "DELETE"
            })
            if (res.ok) {
                toast.success("Sorgu silindi")
                fetchQueries() // Refresh list
            } else {
                toast.error("Sorgu silinemedi")
            }
        } catch (error) {
            console.error("Delete error", error)
            toast.error("Silme işlemi başarısız oldu")
        }
    }

    const handleSelect = (slug: string) => {
        setOpen(false)
        router.push(`/sql-query/${slug}`)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Kayıtlı Sorgular
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kayıtlı Sorgular</DialogTitle>
                    <DialogDescription>
                        Sunucuda kayıtlı sorgularınızı buradan yönetebilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : queries.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                            Henüz kayıtlı sorgu yok.
                        </div>
                    ) : (
                        <div className="h-[300px] w-full rounded-md border p-1 overflow-y-auto">
                            <div className="space-y-1">
                                {queries.map((q) => (
                                    <div
                                        key={q.slug}
                                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
                                        onClick={() => handleSelect(q.slug)}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-2 font-medium text-sm">
                                                <FileText className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="truncate">{q.name}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate pl-5.5 font-mono opacity-70">
                                                {q.slug}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={(e) => handleDelete(q.slug, q.name, e)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
