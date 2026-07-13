'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@datum-cloud/datum-ui/sidebar'
import { ThemedLogo } from '@datum-cloud/datum-ui/logo/themed'
import {
  Activity,
  Boxes,
  LayoutDashboard,
  ScrollText,
  Trophy,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const nav = [
  { title: 'Overview', href: '/', icon: LayoutDashboard },
  { title: 'Logs', href: '/logs', icon: ScrollText },
  { title: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { title: 'Models', href: '/models', icon: Boxes },
  { title: 'Playground', href: '/playground', icon: Activity },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <ThemedLogo.Icon className="size-8 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">Envoy AI Gateway</span>
              <span className="text-xs text-muted-foreground">Observability Console</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(pathname, item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <span className="inline-flex size-2 rounded-full bg-chart-4" aria-hidden />
            Demo data source
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-muted-foreground">
              {nav.find((n) => isActive(pathname, n.href))?.title ?? 'Console'}
            </span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
