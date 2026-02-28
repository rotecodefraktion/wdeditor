'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Server,
  FileText,
  Users,
  Settings,
} from 'lucide-react'
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
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

interface AppSidebarProps {
  isAdmin: boolean
  userEmail: string
  userRole: string
}

function SidebarLogo() {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [logoError, setLogoError] = useState(false)

  return (
    <Link
      href="/dashboard"
      className="flex flex-col items-start group pl-2"
      aria-label="consolut - Dashboard"
    >
      {logoError ? (
        <span
          className={`font-black text-consolut-red transition-all duration-200 ${
            isCollapsed ? 'text-lg' : 'text-2xl'
          }`}
        >
          {isCollapsed ? 'c' : 'consolut'}
        </span>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/conslout_logo.svg"
          alt="consolut"
          onError={() => setLogoError(true)}
          className={`transition-transform duration-200 group-hover:scale-105 ${
            isCollapsed ? 'h-5 w-auto max-w-[2rem]' : 'h-10 w-auto object-contain'
          }`}
        />
      )}
      {!isCollapsed && (
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black dark:text-white pl-[5px] mt-1 block">
          FORCE ENGINE
        </span>
      )}
    </Link>
  )
}

export function AppSidebar({ isAdmin, userEmail, userRole }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('common')
  const tSidebar = useTranslations('sidebar')
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const mainNavItems = [
    {
      label: t('dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('portEditor'),
      href: '/editor/instance-profile',
      icon: Server,
    },
    {
      label: t('rulesEditor'),
      href: '/editor/rules',
      icon: FileText,
    },
  ]

  const adminNavItems = [
    {
      label: t('users'),
      href: '/admin/users',
      icon: Users,
    },
    {
      label: t('settings'),
      href: '/settings',
      icon: Settings,
    },
  ]

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  const initials = userEmail
    ? userEmail.charAt(0).toUpperCase()
    : '?'

  const roleLabel = userRole === 'super_admin'
    ? 'Super Admin'
    : userRole === 'admin'
      ? 'Admin'
      : 'User'

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-6 pt-6 pb-4">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{tSidebar('navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={`h-10 text-[14px] border-l-[3px] transition-all ${
                        active
                          ? 'border-consolut-red font-bold text-consolut-dark dark:text-gray-100'
                          : 'border-transparent text-gray-500 hover:border-consolut-red/40 hover:text-consolut-dark dark:text-gray-400 dark:hover:text-gray-100'
                      }`}
                    >
                      <Link href={item.href}>
                        <item.icon className={`!h-5 !w-5 transition-colors ${
                          active ? 'text-consolut-red' : 'group-hover/menu-button:text-consolut-red'
                        }`} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{tSidebar('administration')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={`h-10 text-[14px] border-l-[3px] transition-all ${
                            active
                              ? 'border-consolut-red font-bold text-consolut-dark dark:text-gray-100'
                              : 'border-transparent text-gray-500 hover:border-consolut-red/40 hover:text-consolut-dark dark:text-gray-400 dark:hover:text-gray-100'
                          }`}
                        >
                          <Link href={item.href}>
                            <item.icon className={`!h-5 !w-5 transition-colors ${
                              active ? 'text-consolut-red' : 'group-hover/menu-button:text-consolut-red'
                            }`} />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="p-2 rounded-md border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer shadow-sm bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center">
            <div
              className="w-10 h-10 rounded-md bg-gray-900 dark:bg-gray-700 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden min-w-0">
                <p className="text-xs font-bold text-consolut-dark dark:text-gray-100 truncate">
                  {userEmail}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
