'use client'

import { useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { locales, type Locale } from '@/i18n/config'

const LOCALE_LABELS: Record<Locale, string> = {
  de: 'DE',
  en: 'EN',
  pt: 'PT',
}

function getCurrentLocale(): Locale {
  if (typeof document === 'undefined') return 'de'
  const match = document.cookie.match(/NEXT_LOCALE=([a-z]{2})/)
  return (match?.[1] as Locale) ?? 'de'
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

export function LanguageSwitcher() {
  const t = useTranslations('language')
  const currentLocale = getCurrentLocale()

  function handleLocaleChange(locale: Locale) {
    if (locale === currentLocale) return
    setLocaleCookie(locale)

    // Persist locale preference to the database (fire-and-forget).
    // If the user is not logged in the API call will return 401 — that is fine.
    fetch('/api/user/locale', {
      method: 'PATCH',
      body: JSON.stringify({ locale }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Ignore errors — the cookie is the primary source during the session
    })

    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('label')}>
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={locale === currentLocale ? 'font-bold' : undefined}
          >
            {LOCALE_LABELS[locale]} - {t(locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
