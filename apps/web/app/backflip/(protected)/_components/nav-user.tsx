"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { RiMore2Line, RiLogoutBoxLine, RiUserLine } from "@remixicon/react"
import Link from "next/link"
import { signOut } from "next-auth/react"

import type { SessionUser } from "./types"

function initials(nameOrEmail: string) {
  return nameOrEmail.slice(0, 2).toUpperCase()
}

export function NavUser({ user }: { user: SessionUser }) {
  const { isMobile } = useSidebar()
  const label = user.name || user.email

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg">
              {user.image ? <AvatarImage src={user.image} alt={label} /> : null}
              <AvatarFallback className="rounded-lg">
                {initials(label)}
              </AvatarFallback>
            </Avatar>
            {/* Collapsed rail = avatar only; the label + chevron leave the
                flow, else `flex-1` shoves the avatar out of the 32px button. */}
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground capitalize">
                {user.role ?? "Member"}
              </span>
            </div>
            <RiMore2Line className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.image ? (
                      <AvatarImage src={user.image} alt={label} />
                    ) : null}
                    <AvatarFallback className="rounded-lg">
                      {initials(label)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{label}</span>
                    <span className="truncate text-xs">
                      {user.email}
                      {user.role ? ` · ${user.role}` : ""}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/backflip/account" />}>
                <RiUserLine />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/backflip/login" })}
            >
              <RiLogoutBoxLine />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
