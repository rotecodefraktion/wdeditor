'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle,
  XCircle,
  Ban,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react'
import { RejectDialog } from '@/components/admin/reject-dialog'
import { DeactivateDialog } from '@/components/admin/deactivate-dialog'
import { RoleSelect } from '@/components/admin/role-select'

export interface UserProfile {
  user_id: string
  email: string | null
  github_username: string | null
  full_name: string | null
  status: 'unconfirmed' | 'pending_approval' | 'active' | 'rejected' | 'deactivated'
  role: 'user' | 'admin' | 'super_admin'
  rejection_reason: string | null
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
}

type StatusFilter = 'all' | 'pending_approval' | 'active' | 'rejected' | 'deactivated'

const STATUS_LABELS: Record<string, string> = {
  unconfirmed: 'Unconfirmed',
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  deactivated: 'Deactivated',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  unconfirmed: 'outline',
  pending_approval: 'default',
  active: 'secondary',
  rejected: 'destructive',
  deactivated: 'outline',
}

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

interface UserTableProps {
  users: UserProfile[]
  loading: boolean
  error: string | null
  currentUserId: string
  currentUserRole: 'admin' | 'super_admin'
  onApprove: (userId: string) => Promise<void>
  onReject: (userId: string, reason?: string) => Promise<void>
  onDeactivate: (userId: string) => Promise<void>
  onReactivate: (userId: string) => Promise<void>
  onRoleChange: (userId: string, role: string) => Promise<void>
}

export function UserTable({
  users,
  loading,
  error,
  currentUserId,
  currentUserRole,
  onApprove,
  onReject,
  onDeactivate,
  onReactivate,
  onRoleChange,
}: UserTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialogUser, setRejectDialogUser] = useState<UserProfile | null>(null)
  const [deactivateDialogUser, setDeactivateDialogUser] = useState<UserProfile | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const USERS_PER_PAGE = 50

  const pendingCount = users.filter((u) => u.status === 'pending_approval').length

  const filteredUsers = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesName = u.full_name?.toLowerCase().includes(q)
      const matchesGithub = u.github_username?.toLowerCase().includes(q)
      const matchesEmail = u.email?.toLowerCase().includes(q)
      const matchesId = u.user_id.toLowerCase().includes(q)
      if (!matchesName && !matchesGithub && !matchesEmail && !matchesId) return false
    }
    return true
  })

  // Sort: pending_approval first, then by created_at desc
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1
    if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / USERS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedUsers = sortedUsers.slice(
    (safePage - 1) * USERS_PER_PAGE,
    safePage * USERS_PER_PAGE
  )

  // Reset to page 1 when filter or search changes
  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val as StatusFilter)
    setCurrentPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  async function handleAction(userId: string, action: () => Promise<void>) {
    setActionLoading(userId)
    try {
      await action()
    } finally {
      setActionLoading(null)
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive font-medium">Failed to load users</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or GitHub username..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All statuses
            </SelectItem>
            <SelectItem value="pending_approval">
              Pending ({pendingCount})
            </SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pending badge */}
      {pendingCount > 0 && statusFilter === 'all' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-2">
          <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {pendingCount} pending registration{pendingCount > 1 ? 's' : ''} awaiting approval
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">GitHub</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="hidden lg:table-cell">Registered</TableHead>
              <TableHead className="hidden lg:table-cell">Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <p className="text-muted-foreground text-sm">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No users match the current filters.'
                      : 'No users found.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const isCurrentUser = user.user_id === currentUserId
                const isLoading = actionLoading === user.user_id

                return (
                  <TableRow
                    key={user.user_id}
                    className={
                      user.status === 'pending_approval'
                        ? 'bg-amber-50/50 dark:bg-amber-950/10'
                        : undefined
                    }
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {user.full_name || 'No name'}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-1">(you)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground md:hidden">
                          {user.github_username || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                        {user.email || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {user.github_username || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[user.status] ?? 'outline'}>
                        {STATUS_LABELS[user.status] ?? user.status}
                      </Badge>
                      {user.status === 'rejected' && user.rejection_reason && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={user.rejection_reason}>
                          {user.rejection_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {currentUserRole === 'super_admin' && user.status === 'active' && !isCurrentUser ? (
                        <RoleSelect
                          currentRole={user.role}
                          disabled={isLoading}
                          onRoleChange={(role) =>
                            handleAction(user.user_id, () => onRoleChange(user.user_id, role))
                          }
                        />
                      ) : (
                        <span className="text-sm">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.status === 'pending_approval' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                              disabled={isLoading}
                              onClick={() =>
                                handleAction(user.user_id, () => onApprove(user.user_id))
                              }
                              aria-label={`Approve ${user.full_name || user.user_id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Approve</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isLoading}
                              onClick={() => setRejectDialogUser(user)}
                              aria-label={`Reject ${user.full_name || user.user_id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Reject</span>
                            </Button>
                          </>
                        )}
                        {user.status === 'active' && !isCurrentUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isLoading}
                            onClick={() => setDeactivateDialogUser(user)}
                            aria-label={`Deactivate ${user.full_name || user.user_id}`}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Deactivate</span>
                          </Button>
                        )}
                        {user.status === 'deactivated' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            disabled={isLoading}
                            onClick={() =>
                              handleAction(user.user_id, () => onReactivate(user.user_id))
                            }
                            aria-label={`Reactivate ${user.full_name || user.user_id}`}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Reactivate</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination & Summary */}
      {!loading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {paginatedUsers.length} of {sortedUsers.length} users
            {sortedUsers.length !== users.length && ` (${users.length} total)`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <RejectDialog
        user={rejectDialogUser}
        onClose={() => setRejectDialogUser(null)}
        onConfirm={async (reason) => {
          if (!rejectDialogUser) return
          await handleAction(rejectDialogUser.user_id, () =>
            onReject(rejectDialogUser.user_id, reason)
          )
          setRejectDialogUser(null)
        }}
      />

      <DeactivateDialog
        user={deactivateDialogUser}
        onClose={() => setDeactivateDialogUser(null)}
        onConfirm={async () => {
          if (!deactivateDialogUser) return
          await handleAction(deactivateDialogUser.user_id, () =>
            onDeactivate(deactivateDialogUser.user_id)
          )
          setDeactivateDialogUser(null)
        }}
      />
    </div>
  )
}
