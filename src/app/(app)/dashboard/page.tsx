import { FileText, Settings, Users } from 'lucide-react'
import { UnconfiguredBanner } from '@/components/settings/unconfigured-banner'
import { GitHubAccessWarning } from '@/components/github/github-access-warning'
import { createClient } from '@/lib/supabase/server'
import { FeatureCard } from '@/components/dashboard/feature-card'

const features = [
  {
    title: 'Instance Profile Port Editor',
    description: 'Manage icm/server_port_* parameters with validation and conflict detection.',
    icon: Settings,
    href: '/editor/instance-profile',
    status: 'Available',
    enabled: true,
  },
  {
    title: 'Rules.txt Rewrite Editor',
    description: 'Edit URL rewrite rules for routing and redirection.',
    icon: FileText,
    href: '/editor/rules',
    status: 'Available',
    enabled: true,
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
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the SAP Web Dispatcher configuration editor.
        </p>
      </div>

      <UnconfiguredBanner userRole={userRole} />
      <GitHubAccessWarning userRole={userRole} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard
            key={feature.href}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            href={feature.href}
            status={feature.status}
            enabled={feature.enabled}
          />
        ))}
      </div>
    </div>
  )
}
