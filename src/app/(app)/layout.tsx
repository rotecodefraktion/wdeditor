import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileNav } from '@/components/mobile-nav'
import { getTranslations } from 'next-intl/server'

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <MobileNav isAdmin={isAdmin} />
            <Link href="/dashboard" className="flex flex-col items-start">
              <span className="text-lg font-black text-consolut-dark dark:text-white leading-tight">consolut</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-consolut-red">WD EDITOR</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/dashboard" className="uppercase tracking-wider text-xs font-bold text-gray-400 hover:text-foreground transition-colors">
                {t('dashboard')}
              </Link>
              <Link href="/editor/instance-profile" className="uppercase tracking-wider text-xs font-bold text-gray-400 hover:text-foreground transition-colors">
                {t('portEditor')}
              </Link>
              <Link href="/editor/rules" className="uppercase tracking-wider text-xs font-bold text-gray-400 hover:text-foreground transition-colors">
                {t('rulesEditor')}
              </Link>
              {isAdmin && (
                <>
                  <Link href="/admin/users" className="uppercase tracking-wider text-xs font-bold text-gray-400 hover:text-foreground transition-colors">
                    {t('users')}
                  </Link>
                  <Link href="/settings" className="uppercase tracking-wider text-xs font-bold text-gray-400 hover:text-foreground transition-colors flex items-center gap-1">
                    <Settings className="h-3.5 w-3.5" />
                    {t('settings')}
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <LanguageSwitcher />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
            {t('footer')}
          </p>
        </div>
      </footer>
    </div>
  )
}
