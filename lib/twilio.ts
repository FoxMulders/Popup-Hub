import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

/**
 * Sends an SMS notification. Silently no-ops if Twilio env vars are not configured,
 * so the app works without SMS in development.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  if (!accountSid || !authToken || !fromNumber) return

  try {
    const client = twilio(accountSid, authToken)
    await client.messages.create({ from: fromNumber, to, body })
  } catch (err) {
    console.error('[Twilio] SMS send failed:', err)
  }
}
