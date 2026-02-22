import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UnconfiguredBanner } from '@/components/settings/unconfigured-banner'
import { createClient } from '@/lib/supabase/server'

const features = [
  {
    title: 'Instance Profile Port Editor',
    description: 'Manage icm/server_port_* parameters with validation and conflict detection.',
    icon: Settings,
    href: '/ports',
    status: 'Coming soon',
    enabled: false,
  },
  {
    title: 'Rules.txt Rewrite Editor',
    description: 'Edit URL rewrite rules for routing and redirection.',
    icon: FileText,
    href: '/rules',
    status: 'Coming soon',
    enabled: false,
  },
  {
    title: 'User Management',
    description: 'Approve or reject user access requests and manage team members.',
    icon: Users,
    href: '/admin/users',
    status: 'Available',
    enabled: true,
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userRole: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    userRole = profile?.role
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the SAP Web Dispatcher configuration editor.
        </p>
      </div>

      <UnconfiguredBanner userRole={userRole} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.href} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <Badge variant={feature.enabled ? 'default' : 'secondary'}>{feature.status}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{feature.title}</CardTitle>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button variant="outline" size="sm" className="w-full" asChild disabled={!feature.enabled}>
                  <Link href={feature.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
