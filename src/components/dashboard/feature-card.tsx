'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
  title: string
  description: string
  icon: LucideIcon
  href: string
  status: string
  enabled: boolean
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  href,
  status,
  enabled,
}: FeatureCardProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -8 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="card-premium relative overflow-hidden flex flex-col"
    >
      <div className="absolute top-0 bottom-0 left-0 w-1 consolut-gradient-v" />
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-md bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-consolut-red">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant={enabled ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        <h3 className="text-base font-semibold mt-3">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="p-6 pt-0 mt-auto">
        <Button variant="outline" size="sm" className="w-full" asChild disabled={!enabled}>
          <Link href={href}>Open</Link>
        </Button>
      </div>
    </motion.div>
  )
}
