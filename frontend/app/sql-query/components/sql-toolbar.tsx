import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Database, Settings2 } from "lucide-react"
import { ConnectionSelector } from "./connection-selector"
import type { Variable, Connection } from "../lib/types"

interface SQLToolbarProps {
    activeTab: "edit" | "preview" | "api"
    setActiveTab: (tab: "edit" | "preview" | "api") => void
    schemaPanelOpen: boolean
    setSchemaPanelOpen: (open: boolean) => void
    variablesPanelOpen: boolean
    setVariablesPanelOpen: (open: boolean) => void
    variables: Variable[]
    selectedConnectionId: string
    setSelectedConnectionId: (id: string) => void
    isConnOpen: boolean
    setIsConnOpen: (open: boolean) => void
    connections: Connection[]
    mounted: boolean
    slug?: string
}

export function SQLToolbar({
    activeTab,
    setActiveTab,
    schemaPanelOpen,
    setSchemaPanelOpen,
    variablesPanelOpen,
    setVariablesPanelOpen,
    variables,
    selectedConnectionId,
    setSelectedConnectionId,
    isConnOpen,
    setIsConnOpen,
    connections,
    mounted
}: SQLToolbarProps) {
    return (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                {mounted && (
                    <ConnectionSelector
                        connections={connections}
                        selectedId={selectedConnectionId}
                        onSelect={(id) => {
                            setSelectedConnectionId(id)
                            setIsConnOpen(false)
                        }}
                        open={isConnOpen}
                        onOpenChange={setIsConnOpen}
                    />
                )}
            </div>
            <div className="flex items-center gap-4">
                <Tabs
                    value={activeTab}
                    onValueChange={(val) => setActiveTab(val as "edit" | "preview" | "api")}
                    className="w-auto"
                >
                    {mounted && (
                        <TabsList className="inline-flex h-9 p-1 bg-muted rounded-lg">
                            <TabsTrigger
                                value="edit"
                                className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                            >
                                Query
                            </TabsTrigger>
                            <TabsTrigger
                                value="preview"
                                className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                            >
                                SQL
                            </TabsTrigger>
                            <TabsTrigger
                                value="api"
                                className="px-3 text-xs rounded-md text-muted-foreground data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/50 transition-all font-medium"
                            >
                                API
                            </TabsTrigger>
                        </TabsList>
                    )}
                </Tabs>
                <div className="flex items-center p-1 bg-muted rounded-lg h-9">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-full px-3 text-xs gap-2 rounded-md hover:bg-background/50 hover:text-foreground transition-all font-medium ${schemaPanelOpen ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                        onClick={() => {
                            if (schemaPanelOpen) {
                                setSchemaPanelOpen(false)
                            } else {
                                setSchemaPanelOpen(true)
                                setVariablesPanelOpen(false)
                            }
                        }}
                    >
                        <Database className="h-3.5 w-3.5" />
                        Şema
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-full px-3 text-xs gap-2 rounded-md hover:bg-background/50 hover:text-foreground transition-all font-medium ${variablesPanelOpen ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                        onClick={() => {
                            if (variablesPanelOpen) {
                                setVariablesPanelOpen(false)
                            } else {
                                setVariablesPanelOpen(true)
                                setSchemaPanelOpen(false)
                            }
                        }}
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                        Kriterler
                        {variables.length > 0 && (
                            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${variablesPanelOpen ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                                {variables.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
