import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const accounts = [
  {
    role: 'coordinator',
    email: 'coordinator@coordinator.dev',
    password: 'coordinator',
    fullName: 'Dev Coordinator',
  },
  {
    role: 'vendor',
    email: 'vendor@vendor.dev',
    password: 'vendor',
    fullName: 'Dev Vendor',
  },
  {
    role: 'shopper',
    email: 'patron@patron.dev',
    password: 'patron',
    fullName: 'Dev Patron',
  },
]

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function findUserByEmail(email) {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })
  const body = await res.json()
  const users = body.users ?? body
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function createOrUpdateUser({ email, password, role, fullName }) {
  const existing = await findUserByEmail(email)

  if (existing) {
    const res = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName },
      }),
    })
    if (!res.ok) throw new Error(`update ${email}: ${JSON.stringify(await res.json())}`)
    return existing.id
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: fullName },
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`create ${email}: ${JSON.stringify(body)}`)
  return body.user?.id ?? body.id
}

async function upsertProfile(userId, { email, role, fullName }) {
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: userId,
      email,
      role,
      full_name: fullName,
    }),
  })
  if (!res.ok) throw new Error(`profile ${email}: ${JSON.stringify(await res.json())}`)
}

async function verifySignIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`sign-in ${email}: ${JSON.stringify(body)}`)
}

async function main() {
  const ids = {}

  for (const account of accounts) {
    const profileRole = account.role === 'shopper' ? 'shopper' : account.role
    const userId = await createOrUpdateUser(account)
    await upsertProfile(userId, {
      email: account.email,
      role: profileRole,
      fullName: account.fullName,
    })
    await verifySignIn(account.email, account.password)
    ids[account.role] = userId
    console.log(`ok ${account.role} ${account.email}`)
  }

  await fetch(`${url}/rest/v1/coordinator_vendor_approvals`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      coordinator_id: ids.coordinator,
      vendor_user_id: ids.vendor,
    }),
  })

  console.log('linked dev coordinator vendor approval (does not reassign real events)')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
