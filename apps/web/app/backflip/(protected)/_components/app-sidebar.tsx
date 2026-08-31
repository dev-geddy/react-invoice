"use client"

import type { ComponentProps, ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
  RiDashboardLine,
  RiGroupLine,
  RiCheckboxMultipleBlankLine,
  RiShapesLine,
  RiUserLine,
} from "@remixicon/react"

import { BrandIcon } from "@/app/_components/brand-icon"
import { can, type Capability } from "@/app/_lib/auth/permissions"
import { NavUser } from "./nav-user"
import type { SessionUser } from "./types"

type NavItem = {
  title: string
  url: string
  icon: ComponentType<{ className?: string }>
  capability: Capability
}

/** Nav grouped into design's labeled sections; each item declares its
 *  capability. The Settings group is pinned to the bottom (above the user). */
const NAV_GROUPS: { label: string; pinBottom?: boolean; items: NavItem[] }[] = [
  {
    label: "Platform",
    items: [
      {
        title: "Overview",
        url: "/backflip",
        icon: RiDashboardLine,
        capability: "dashboard",
      },
      {
        title: "UI samples",
        url: "/backflip/ui-samples",
        icon: RiShapesLine,
        capability: "dashboard",
      },
    ],
  },
  {
    label: "Settings",
    pinBottom: true,
    items: [
      {
        title: "Members",
        url: "/backflip/users",
        icon: RiGroupLine,
        capability: "users.view",
      },
      {
        title: "Account",
        url: "/backflip/account",
        icon: RiUserLine,
        capability: "account",
      },
      {
        title: "Integrations",
        url: "/backflip/settings",
        icon: RiCheckboxMultipleBlankLine,
        capability: "settings",
      },
    ],
  },
]

function isActive(pathname: string, url: string) {
  return url === "/backflip" ? pathname === url : pathname.startsWith(url)
}

export function AppSidebar({
  user,
  ...props
}: ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  const pathname = usePathname()

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(user.role, i.capability)),
  })).filter((g) => g.items.length > 0)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/backflip" />}
              className="gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              {/* Same brand tile as the public wordmark (bordered card tile +
                  arc glyph), not an icon-on-primary block. */}
              <div className="flex aspect-square size-7 flex-none items-center justify-center rounded-md border bg-card">
                <BrandIcon size={14} className="text-primary" />
              </div>
              {/* Collapsed rail = icon only: the label block leaves the flow
                  entirely, otherwise `flex-1` keeps its intrinsic width and
                  shoves the tile out of the 32px button (overflow-hidden). */}
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">Backflip</span>
                <span className="text-xs text-muted-foreground">
                  Admin console
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup
            key={group.label}
            className={group.pinBottom ? "mt-auto" : undefined}
          >
            <SidebarGroupLabel className="text-[11px] tracking-wide uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive(pathname, item.url)}
                      render={<Link href={item.url} />}
                      className="gap-2.5 text-[13px] data-active:font-semibold"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
