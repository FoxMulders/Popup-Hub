import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Category, Profile, VendorPassport, VendorProduct } from '@/types/database'

export type PassportPageData = {
  profile: Profile
  passport: VendorPassport | null
  categories: Category[]
  products: VendorProduct[]
}

export async function loadPassportPageData(): Promise<PassportPageData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: categories }, { data: passport }, { data: products }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('categories').select('*').order('name'),
      supabase
        .from('vendor_passports')
        .select('*, category:categories(name)')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('vendor_products')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  if (!profile) redirect('/login')

  return {
    profile: profile as Profile,
    passport: (passport as VendorPassport | null) ?? null,
    categories: (categories as Category[]) ?? [],
    products: (products as VendorProduct[]) ?? [],
  }
}
