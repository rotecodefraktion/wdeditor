'use client'

import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RoleSelectProps {
  currentRole: string
  disabled: boolean
  onRoleChange: (role: string) => void
}

export function RoleSelect({ currentRole, disabled, onRoleChange }: RoleSelectProps) {
  const t = useTranslations('admin')
  return (
    <Select
      value={currentRole}
      onValueChange={onRoleChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[130px] h-8 text-xs" aria-label={t('changeRole')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">{t('roleUser')}</SelectItem>
        <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
        <SelectItem value="super_admin">{t('roleSuperAdmin')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
