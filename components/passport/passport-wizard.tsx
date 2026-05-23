'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Upload, ArrowRight, ArrowLeft, CheckCircle, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Category, VendorPassport } from '@/types/database'
import { sortCategoriesByName } from '@/lib/categories'
import { normalizeUrl } from '@/lib/vendor/normalize-url'
import { resolvePassportCategoryIds, toggleCategoryId } from '@/lib/vendor/passport-categories'
import { dispatchAvatarChanged } from '@/lib/profile/avatar-sync'
import { cn } from '@/lib/utils'
import { VendorLogo } from '@/components/vendor/vendor-logo'

interface PassportWizardProps {
  categories: Category[]
  existing?: VendorPassport | null
  userId: string
}

const STEPS = ['Business Info', 'Category', 'Tax & Compliance', 'Photos']

export function PassportWizard({ categories, existing, userId }: PassportWizardProps) {
  const sortedCategories = sortCategoriesByName(categories)
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [businessName, setBusinessName] = useState(existing?.business_name ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>(() =>
    resolvePassportCategoryIds(existing ?? {})
  )
  const [taxId, setTaxId] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(existing?.logo_url ?? '')
  const [itemFiles, setItemFiles] = useState<File[]>([])
  const [itemPreviews, setItemPreviews] = useState<string[]>(existing?.item_image_urls ?? [])
  const [websiteUrl, setWebsiteUrl] = useState(existing?.website_url ?? '')
  const [shopUrl, setShopUrl] = useState(existing?.shop_url ?? '')
  const [instagramUrl, setInstagramUrl] = useState(existing?.instagram_url ?? '')

  async function uploadFile(file: File, bucket: string, path: string): Promise<string | null> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleItemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 6)
    setItemFiles(files)
    setItemPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function handleSubmit() {
    if (!businessName.trim()) {
      toast.error('Business name is required')
      return
    }
    if (categoryIds.length === 0) {
      toast.error('Select at least one business category')
      return
    }
    setLoading(true)

    try {
      let logoUrl = existing?.logo_url ?? null
      if (logoFile) {
        const url = await uploadFile(logoFile, 'vendor-assets', `${userId}/logo-${Date.now()}`)
        if (url) logoUrl = url
      }

      const uploadedItemUrls: string[] = [...(existing?.item_image_urls ?? [])]
      for (const file of itemFiles) {
        const url = await uploadFile(file, 'vendor-assets', `${userId}/item-${Date.now()}-${file.name}`)
        if (url) uploadedItemUrls.push(url)
      }

      const passportData = {
        user_id: userId,
        business_name: businessName,
        bio: bio || null,
        primary_category_id: categoryIds[0] ?? null,
        category_ids: categoryIds,
        logo_url: logoUrl,
        item_image_urls: uploadedItemUrls.slice(0, 6),
        tax_id_encrypted: taxId ? btoa(taxId) : existing?.tax_id_encrypted ?? null,
        website_url: normalizeUrl(websiteUrl),
        shop_url: normalizeUrl(shopUrl),
        instagram_url: normalizeUrl(instagramUrl),
      }

      if (existing) {
        const { error } = await supabase
          .from('vendor_passports')
          .update(passportData)
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vendor_passports')
          .insert(passportData)
        if (error) throw error
      }

      toast.success('Passport saved! Ready to apply to events.')
      dispatchAvatarChanged(userId)
      router.push('/vendor/events')
      router.refresh()
    } catch (err) {
      toast.error('Failed to save passport. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="mx-auto max-w-xl">
      {/* Step indicators */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs text-gray-500">
          <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? 'bg-amber-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && 'Tell markets who you are and what you sell'}
            {step === 1 && 'Select all categories that apply to your business'}
            {step === 2 && 'Tax identification for compliance purposes'}
            {step === 3 && 'Upload your logo and product photos'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Business Info */}
          {step === 0 && (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="biz-name">Business Name *</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">Your official business or brand name as it will appear to shoppers and coordinators.</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="biz-name"
                  placeholder="e.g. Sweet Petal Candles"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="bio">Business Bio</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">Tell shoppers and coordinators what makes your business unique. Include what you sell, your story, and what sets you apart.</TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="bio"
                  placeholder="Tell shoppers what makes your products unique…"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-right text-xs text-gray-400">{bio.length}/500</p>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Online presence (optional — shown to shoppers)
                </p>
                <div className="space-y-1">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    placeholder="https://yourbusiness.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shop">Online shop</Label>
                  <Input
                    id="shop"
                    placeholder="Etsy, Shopify, etc."
                    value={shopUrl}
                    onChange={(e) => setShopUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    placeholder="https://instagram.com/yourbrand"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 1: Category */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Label>Business Categories *</Label>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Select every category that describes what you sell. Coordinators use this to match you to the right booth slots.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-gray-600">
                Select all categories that apply to your business.
              </p>
              <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                {sortedCategories.map((cat) => {
                  const selected = categoryIds.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryIds((prev) => toggleCategoryId(prev, cat.id))}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left text-sm transition',
                        selected
                          ? 'border-amber-400 bg-amber-50 font-medium text-amber-900'
                          : 'border-stone-200 bg-white text-gray-700 hover:border-amber-200'
                      )}
                      aria-pressed={selected}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
              {categoryIds.length > 0 ? (
                <p className="text-xs text-gray-500">
                  {categoryIds.length} categor{categoryIds.length === 1 ? 'y' : 'ies'} selected
                </p>
              ) : (
                <p className="text-xs text-amber-700">Choose at least one category to continue.</p>
              )}
            </div>
          )}

          {/* Step 2: Tax */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="tax">EIN / Tax ID</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">Your CRA Business Number (Canada) or EIN (US). This is encrypted and only visible to you. Required for payouts.</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="tax"
                  placeholder="XX-XXXXXXX"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  autoComplete="off"
                  type="password"
                />
                <p className="text-xs text-gray-500">
                  Encrypted and stored securely. Required by some coordinators. Leave blank if not applicable.
                </p>
              </div>
              {existing?.tax_id_encrypted && !taxId && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Tax ID on file
                </p>
              )}
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Business Logo</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Your full logo is shown as-is on your profile, roster, and promotional materials.
                      PNG or JPG with a transparent or white background works well.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 hover:border-amber-400 transition">
                  {logoPreview ? (
                    <VendorLogo
                      src={logoPreview}
                      alt="Logo preview"
                      size="xl"
                      className="mx-auto max-w-full border-dashed"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-400" />
                  )}
                  <span className="text-xs text-gray-500 text-center">
                    Click to upload your full logo (JPG, PNG, max 2MB)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Product Photos (up to 6)</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">Photos of your actual products. Add up to 6 images to showcase what you sell at markets.</TooltipContent>
                  </Tooltip>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 hover:border-amber-400 transition">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-xs text-gray-500">Click to upload product photos</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleItemChange}
                  />
                </label>
                {itemPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {itemPreviews.slice(0, 6).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Product ${i + 1}`}
                        className="aspect-square rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={
                  (step === 0 && !businessName.trim()) ||
                  (step === 1 && categoryIds.length === 0)
                }
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={loading || !businessName.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Save Passport
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
