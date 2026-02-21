'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { UserTable, type UserProfile } from '@/components/admin/user-table'
import { toast } from 'sonner'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'super_admin'>('admin')

  const supabase = createClient()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch users')
      }
      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        if (profile?.role === 'super_admin') {
          setCurrentUserRole('super_admin')
        }
      }
      fetchUsers()
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUsers])

  async function handleApprove(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to approve user')
      return
    }
    toast.success('User approved successfully')
    await fetchUsers()
  }

  async function handleReject(userId: string, reason?: string) {
    const res = await fetch(`/api/admin/users/${userId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to reject user')
      return
    }
    toast.success('User rejected')
    await fetchUsers()
  }

  async function handleDeactivate(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/deactivate`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to deactivate user')
      return
    }
    toast.success('User deactivated')
    await fetchUsers()
  }

  async function handleReactivate(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/reactivate`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to reactivate user')
      return
    }
    toast.success('User reactivated')
    await fetchUsers()
  }

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to change role')
      return
    }
    toast.success('Role updated successfully')
    await fetchUsers()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user registrations, access control, and roles.
        </p>
      </div>

      <UserTable
        users={users}
        loading={loading}
        error={error}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onApprove={handleApprove}
        onReject={handleReject}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onRoleChange={handleRoleChange}
      />
    </div>
  )
}
