import { Resend } from 'resend'

/**
 * Escapes a string for safe insertion into HTML.
 * Prevents HTML injection by replacing dangerous characters with entities.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS || 'WD Editor <noreply@example.com>'
}

/**
 * Sends an approval notification email (in German).
 */
export async function sendApprovalEmail(to: string, userName: string) {
  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: 'Dein Account wurde genehmigt',
    html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #16a34a;">Account genehmigt</h2>
  <p>Hallo ${escapeHtml(userName || 'Benutzer')},</p>
  <p>dein Account fuer den SAP Web Dispatcher Config Editor wurde genehmigt. Du kannst dich ab sofort einloggen und mit der Arbeit beginnen.</p>
  <p style="margin-top: 24px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
       style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Jetzt einloggen
    </a>
  </p>
  <p style="margin-top: 24px; font-size: 14px; color: #666;">
    Bei Fragen wende dich bitte an deinen Administrator.
  </p>
</body>
</html>
    `.trim(),
  })

  if (error) {
    console.error('[email] Failed to send approval email:', error)
    throw error
  }
}

/**
 * Sends a rejection notification email (in German).
 */
export async function sendRejectionEmail(
  to: string,
  userName: string,
  reason?: string | null
) {
  const reasonBlock = reason
    ? `<p><strong>Begruendung:</strong> ${escapeHtml(reason)}</p>`
    : ''

  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: 'Dein Account wurde abgelehnt',
    html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #dc2626;">Account abgelehnt</h2>
  <p>Hallo ${escapeHtml(userName || 'Benutzer')},</p>
  <p>leider wurde dein Account fuer den SAP Web Dispatcher Config Editor abgelehnt.</p>
  ${reasonBlock}
  <p style="margin-top: 24px; font-size: 14px; color: #666;">
    Falls du Fragen hast, wende dich bitte an deinen Administrator.
  </p>
</body>
</html>
    `.trim(),
  })

  if (error) {
    console.error('[email] Failed to send rejection email:', error)
    throw error
  }
}

/**
 * Sends a reactivation notification email (in German).
 */
export async function sendReactivationEmail(to: string, userName: string) {
  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: 'Dein Account wurde reaktiviert',
    html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #16a34a;">Account reaktiviert</h2>
  <p>Hallo ${escapeHtml(userName || 'Benutzer')},</p>
  <p>dein Account fuer den SAP Web Dispatcher Config Editor wurde reaktiviert. Du kannst dich ab sofort wieder einloggen.</p>
  <p style="margin-top: 24px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
       style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Jetzt einloggen
    </a>
  </p>
  <p style="margin-top: 24px; font-size: 14px; color: #666;">
    Bei Fragen wende dich bitte an deinen Administrator.
  </p>
</body>
</html>
    `.trim(),
  })

  if (error) {
    console.error('[email] Failed to send reactivation email:', error)
    throw error
  }
}
