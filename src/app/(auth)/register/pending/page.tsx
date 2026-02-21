import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PendingApprovalPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-muted p-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <CardTitle>Account Pending Approval</CardTitle>
        <CardDescription>
          Your email has been confirmed. An administrator will review your
          registration request and you&apos;ll receive an email once your account is
          approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          If you have not received a response within 24 hours, please contact your
          SAP administrator directly.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">Back to Sign In</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
