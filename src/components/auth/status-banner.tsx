import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const STATUS_MESSAGES: Record<string, string> = {
  unconfirmed: 'Please confirm your email address before signing in.',
  pending_approval: 'Your account is pending administrator approval.',
  rejected: 'Your access request has been rejected. Please contact an administrator.',
  deactivated: 'Your account has been deactivated. Please contact an administrator.',
  invalid_credentials: 'Invalid email or password.',
  server_error: 'An unexpected error occurred. Please try again later.',
  unknown_status: 'Your account status could not be determined. Please contact an administrator.',
}

interface StatusBannerProps {
  status: string | null
}

export function StatusBanner({ status }: StatusBannerProps) {
  if (!status) return null

  const message = STATUS_MESSAGES[status] ?? 'An error occurred. Please try again.'

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
