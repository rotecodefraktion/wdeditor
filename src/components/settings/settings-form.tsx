'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Eye, EyeOff, Plug, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { ConnectionTestResults } from './connection-test-results'
import {
  settingsFormSchema,
  type SettingsFormValues,
  type SettingsResponse,
  type ConnectionCheckResult,
} from '@/lib/settings-schema'

export function SettingsForm() {
  const t = useTranslations('settings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<ConnectionCheckResult[]>([])
  const [showPat, setShowPat] = useState(false)
  const [hasPat, setHasPat] = useState(false)
  const [patHint, setPatHint] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      github_repo: '',
      github_pat: '',
      dev_branch: 'dev',
      instance_profile_path: '',
      rules_txt_path: '',
    },
  })

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load settings')
      }
      const data: SettingsResponse = await res.json()

      form.reset({
        github_repo: data.github_repo,
        github_pat: '', // Never pre-fill PAT
        dev_branch: data.dev_branch || 'dev',
        instance_profile_path: data.instance_profile_path,
        rules_txt_path: data.rules_txt_path,
      })

      setHasPat(data.has_pat)
      setPatHint(data.github_pat_hint)
      setLastUpdated(data.updated_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function onSubmit(values: SettingsFormValues) {
    setSaving(true)
    setTestResults([])

    try {
      // If no new PAT provided but one already exists, that's fine
      if (!values.github_pat && !hasPat) {
        form.setError('github_pat', {
          message: t('patRequired'),
        })
        setSaving(false)
        return
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details?.fieldErrors) {
          // Set field-level errors from server validation
          const fieldErrors = data.details.fieldErrors as Record<
            string,
            string[]
          >
          Object.entries(fieldErrors).forEach(([field, messages]) => {
            if (messages && messages.length > 0) {
              form.setError(field as keyof SettingsFormValues, {
                message: messages[0],
              })
            }
          })
        } else {
          toast.error(data.error || t('saveError'))
        }
        return
      }

      toast.success(t('savedSuccess'))
      // Refresh to get updated state (PAT hint, timestamp)
      await fetchSettings()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResults([])

    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || t('connectionFailed'))
        return
      }

      setTestResults(data.results)

      // Show summary toast
      const failCount = data.results.filter(
        (r: ConnectionCheckResult) => r.status === 'fail'
      ).length
      const warnCount = data.results.filter(
        (r: ConnectionCheckResult) => r.status === 'warn'
      ).length

      if (failCount > 0) {
        toast.error(t('connectionFailCount', { count: failCount }))
      } else if (warnCount > 0) {
        toast.warning(t('connectionWarnCount', { count: warnCount }))
      } else {
        toast.success(t('connectionSuccess'))
      }
    } catch {
      toast.error(t('connectionTestError'))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <SettingsFormSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t('loadError', { error })}{' '}
          <Button variant="link" className="p-0 h-auto" onClick={fetchSettings}>
            {t('tryAgain')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* GitHub Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('githubRepoTitle')}</CardTitle>
            <CardDescription>
              {t('githubRepoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="github_repo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('repositoryLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('repositoryPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('repositoryDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="github_pat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('patLabel')}</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPat ? 'text' : 'password'}
                        placeholder={
                          hasPat
                            ? t('patPlaceholderExisting', { hint: patHint || '****' })
                            : t('patPlaceholderNew')
                        }
                        className="pr-10"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPat(!showPat)}
                      aria-label={showPat ? t('hideToken') : t('showToken')}
                    >
                      {showPat ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <FormDescription>
                    {hasPat
                      ? t('patDescriptionExisting')
                      : t('patDescriptionNew')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dev_branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('devBranchLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('devBranchPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('devBranchDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* File Paths Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('filePathsTitle')}</CardTitle>
            <CardDescription>
              {t('filePathsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="instance_profile_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('instanceProfilePathLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('instanceProfilePathPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('instanceProfilePathDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rules_txt_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('rulesTxtPathLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('rulesTxtPathPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('rulesTxtPathDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="space-y-4">
          <Separator />

          {/* Connection Test */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || saving}
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              {testing ? t('testingConnection') : t('testConnection')}
            </Button>

            <ConnectionTestResults results={testResults} />
          </div>

          <Separator />

          {/* Save */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {lastUpdated
                ? t('lastSaved', { date: new Date(lastUpdated).toLocaleString() })
                : t('notConfiguredYet')}
            </div>
            <Button type="submit" disabled={saving || testing}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? t('saving') : t('saveSettings')}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

/** Loading skeleton for the settings form */
function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-56" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Separator />
        <Skeleton className="h-10 w-40" />
        <Separator />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  )
}
