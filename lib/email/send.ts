interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * Priority transactional email via Resend (optional — skips gracefully if unset).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'Popup Hub <noreply@popuphub.app>'

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set; skipping:', params.subject, '→', params.to)
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: body || res.statusText }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    return { ok: false, error: message }
  }
}
