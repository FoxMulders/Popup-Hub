import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PassportWizard } from '@/components/passport/passport-wizard'
import { VendorProductManager } from '@/components/vendor/vendor-product-manager'
import type { Category, VendorPassport, VendorProduct } from '@/types/database'

export default async function VendorPassportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: existing }, { data: products }, { data: profile }] =
    await Promise.all([
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
    supabase.from('profiles').select('is_beta_tester').eq('id', user.id).maybeSingle(),
  ])

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 xl:px-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">
          {existing ? 'Update Your Passport' : 'Create Your Vendor Passport'}
        </h1>
        <p className="mt-1.5 text-lg text-gray-500">
          Your passport is your universal business identity across all Popup Hub markets.
        </p>
      </div>
      <PassportWizard
        categories={(categories as Category[]) ?? []}
        existing={existing as VendorPassport | null}
        userId={user.id}
      />
      {existing && (
        <VendorProductManager
          userId={user.id}
          products={(products as VendorProduct[]) ?? []}
          isBetaTester={profile?.is_beta_tester ?? false}
        />
      )}
    </div>
  )
}
