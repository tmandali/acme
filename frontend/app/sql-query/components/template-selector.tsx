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
import { FileText, Check, Save, Upload, Download } from "lucide-react"
import { TemplateMetadata } from "../lib/types"

interface TemplateSelectorProps {
    templates: TemplateMetadata[]
    activeTemplate: TemplateMetadata | null
    onSelectTemplate: (template: TemplateMetadata | null) => void
    onSaveToServer: () => void
    onOpenFile: () => void
    onSaveToYaml: () => void
    fileInputRef: React.RefObject<HTMLInputElement>
    handleLoadFromYaml: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TemplateSelector({
    templates,
    activeTemplate,
    onSelectTemplate,
    onSaveToServer,
    onOpenFile,
    onSaveToYaml,
    fileInputRef,
    handleLoadFromYaml
}: TemplateSelectorProps) {
    if (templates.length === 0) return null

    return (
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-dashed">
                        <FileText className="h-3.5 w-3.5" />
                        {activeTemplate ? activeTemplate.name : "Şablon Seç"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                        <CommandInput placeholder="Şablon ara..." />
                        <CommandList>
                            <CommandEmpty>Şablon bulunamadı.</CommandEmpty>
                            <CommandGroup heading="Rapor Şablonları">
                                <CommandItem
                                    onSelect={() => onSelectTemplate(null)}
                                    className="cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span>Boş Sorgu</span>
                                        <span className="text-[10px] text-muted-foreground">Sıfırdan SQL yaz</span>
                                    </div>
                                    {activeTemplate === null && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                                {templates.map(t => (
                                    <CommandItem
                                        key={t.name}
                                        onSelect={() => onSelectTemplate(t)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex flex-col">
                                            <span>{t.description || t.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{t.name}</span>
                                        </div>
                                        {activeTemplate?.name === t.name && <Check className="ml-auto h-4 w-4" />}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Gizli file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml"
                onChange={handleLoadFromYaml}
                className="hidden"
            />
            <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/10" onClick={onSaveToServer}>
                <Save className="h-3.5 w-3.5" />
                Kaydet
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={onOpenFile}>
                <Upload className="h-3.5 w-3.5" />
                Yükle
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={onSaveToYaml}>
                <Download className="h-3.5 w-3.5" />
                İndir
            </Button>
        </div>
    )
}
