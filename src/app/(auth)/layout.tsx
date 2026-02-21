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
            <h1 className="text-2xl font-bold tracking-tight">
              SAP Web Dispatcher Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configuration management for SAP administrators
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
