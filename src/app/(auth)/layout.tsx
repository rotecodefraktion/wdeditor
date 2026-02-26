import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-consolut-dark dark:text-white leading-tight">consolut</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-consolut-red">WD EDITOR</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Configuration management for SAP administrators
            </p>
          </div>
          <div className="card-premium relative overflow-hidden p-6">
            <div className="absolute top-0 bottom-0 left-0 w-1 consolut-gradient-v" />
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
