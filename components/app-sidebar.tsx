"use client"

import * as React from "react"
import {
  Home,
  TrendingUp,
  ChevronDown,
  Building2,
  Database,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCompany } from "@/contexts/company-context"

// Minimalist menü yapısı
const data = {
  user: {
    name: "Administrator",
    email: "admin@example.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
    },
    {
      title: "Selling",
      url: "/selling",
      icon: TrendingUp,
    },
    {
      title: "SQL Query",
      url: "/sql-query",
      icon: Database,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectedCompany, setSelectedCompany, currentCompany, companies } = useCompany()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="cursor-pointer">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-foreground text-background text-sm font-medium">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-medium text-sm tracking-tight">ACME</span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {currentCompany?.name}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto h-4 w-4 opacity-40" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[240px]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuRadioGroup value={selectedCompany} onValueChange={setSelectedCompany}>
                    {companies.map((company) => (
                      <DropdownMenuRadioItem
                        key={company.id}
                        value={company.id}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[10px] font-medium">
                            {company.code}
                          </div>
                          <span className="text-sm">{company.name}</span>
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
