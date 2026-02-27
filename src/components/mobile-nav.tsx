'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface MobileNavProps {
  isAdmin: boolean
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('common')

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('openNavigation')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-left">{t('navigation')}</SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/dashboard">{t('dashboard')}</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/editor/instance-profile">{t('portEditor')}</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/editor/rules">{t('rulesEditor')}</Link>
          </Button>
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href="/admin/users">{t('users')}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href="/settings">{t('settings')}</Link>
              </Button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
