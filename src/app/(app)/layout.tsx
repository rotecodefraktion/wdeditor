import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileNav } from '@/components/mobile-nav'

async function SignOutButton() {
  return (
    <form action="/auth/signout" method="POST">
      <Button variant="ghost" size="sm" type="submit">
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </form>
  )
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
            <Link href="/dashboard" className="font-semibold text-sm">
              SAP Web Dispatcher Editor
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/editor/instance-profile">Port Editor</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/editor/rules">Rules Editor</Link>
              </Button>
              {isAdmin && (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/users">Users</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings">
                      <Settings className="h-4 w-4 mr-1" />
                      Settings
                    </Link>
                  </Button>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground text-center">
            SAP Web Dispatcher Editor
          </p>
        </div>
      </footer>
    </div>
  )
}
