import { FileText, Settings, Users } from 'lucide-react'
import { UnconfiguredBanner } from '@/components/settings/unconfigured-banner'
import { GitHubAccessWarning } from '@/components/github/github-access-warning'
import { createClient } from '@/lib/supabase/server'
import { FeatureCard } from '@/components/dashboard/feature-card'
import { getTranslations } from 'next-intl/server'

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
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

  const features = [
    {
      title: t('portEditorTitle'),
      description: t('portEditorDescription'),
      icon: <Settings className="h-5 w-5" />,
      href: '/editor/instance-profile',
      status: t('available'),
      enabled: true,
    },
    {
      title: t('rulesEditorTitle'),
      description: t('rulesEditorDescription'),
      icon: <FileText className="h-5 w-5" />,
      href: '/editor/rules',
      status: t('available'),
      enabled: true,
    },
    {
      title: t('userManagementTitle'),
      description: t('userManagementDescription'),
      icon: <Users className="h-5 w-5" />,
      href: '/admin/users',
      status: t('available'),
      enabled: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('welcome')}
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
