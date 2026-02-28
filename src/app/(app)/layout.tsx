import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'

async function SignOutButton() {
  const t = await getTranslations('common')
  return (
    <form action="/auth/signout" method="POST">
      <Button variant="ghost" size="sm" type="submit">
        <LogOut className="h-4 w-4 mr-2" />
        {t('signOut')}
      </Button>
    </form>
  )
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('common')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const userRole = profile?.role ?? 'user'

  // Read sidebar state from cookie for server-side default
  const cookieStore = await cookies()
  const sidebarCookie = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarCookie?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        isAdmin={isAdmin}
        userEmail={user.email ?? ''}
        userRole={userRole}
      />
      <SidebarInset className="min-h-svh flex flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label={t('openNavigation')} />
            <Separator orientation="vertical" className="h-4" />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <div className="flex-1 px-4 py-6 md:px-6">
          {children}
        </div>
        <footer className="shrink-0 border-t py-4">
          <div className="px-4 md:px-6">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              {t('footer')}
            </p>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
