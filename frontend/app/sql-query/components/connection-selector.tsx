"use client"

import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Database, ChevronsUpDown, Check } from "lucide-react"

export interface Connection {
    id: string
    name: string
    type: string
}

interface ConnectionSelectorProps {
    connections: Connection[]
    selectedId: string
    onSelect: (id: string) => void
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ConnectionSelector({
    connections,
    selectedId,
    onSelect,
    open,
    onOpenChange
}: ConnectionSelectorProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="h-7 w-[220px] justify-between text-xs px-2 hover:bg-muted/50 font-normal shadow-none border-none"
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedId
                            ? connections.find((c) => c.id === selectedId)?.name
                            : "Bağlantı seçin..."}
                    </div>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Bağlantı ara..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">Bağlantı bulunamadı.</CommandEmpty>
                        <CommandGroup>
                            {connections.map((conn) => (
                                <CommandItem
                                    key={conn.id}
                                    value={conn.name}
                                    onSelect={() => {
                                        onSelect(conn.id)
                                        onOpenChange(false)
                                    }}
                                    className="text-xs py-2"
                                >
                                    <Check
                                        className={`mr-2 h-3.5 w-3.5 transition-opacity ${selectedId === conn.id ? "opacity-100" : "opacity-0"
                                            }`}
                                    />
                                    <div className="flex flex-col">
                                        <span>{conn.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase font-mono">{conn.type}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
