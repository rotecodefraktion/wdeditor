'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Navigation oeffnen"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-left">Navigation</SheetTitle>
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
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/editor/instance-profile">Port Editor</Link>
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
                <Link href="/admin/users">Users</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href="/settings">Settings</Link>
              </Button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
