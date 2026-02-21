'use client'

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
  return (
    <Select
      value={currentRole}
      onValueChange={onRoleChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[130px] h-8 text-xs" aria-label="Change user role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">User</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="super_admin">Super Admin</SelectItem>
      </SelectContent>
    </Select>
  )
}
