'use client'

import { useMemo, useState, type ReactNode } from 'react'
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
import { normalizeUrl, normalizeTikTokUrl } from '@/lib/vendor/normalize-url'
import {
  filterPassportNicheCategories,
  isPassportMlmBroadCategory,
  resolvePassportCategoryIds,
  stripMlmNicheCategoryIds,
  toggleCategoryId,
} from '@/lib/vendor/passport-categories'
import { buildPassportSavePayload, formatSupabaseError } from '@/lib/vendor/passport-payload'
import { evaluateAndScoreVendorPassport, socialHandleFromInstagram } from '@/lib/vendor/verification'
import { uploadVendorAsset } from '@/lib/vendor/upload-vendor-asset'
import { dispatchAvatarChanged } from '@/lib/profile/avatar-sync'
import { cn } from '@/lib/utils'
import { resetWizardScrollAnchor } from '@/lib/wizard/wizard-scroll-anchor'
import { VendorLogo } from '@/components/vendor/vendor-logo'

interface PassportWizardProps {
  categories: Category[]
  existing?: VendorPassport | null
  userId: string
  redirectAfterSave?: string
  /** Rendered inside the wizard card (e.g. featured products) above navigation. */
  featuredProductsSlot?: ReactNode
}

const STEPS = ['Business Info', 'Category', 'Photos']

export function PassportWizard({
  categories,
  existing,
  userId,
  redirectAfterSave = '/vendor/events',
  featuredProductsSlot,
}: PassportWizardProps) {
  const sortedCategories = sortCategoriesByName(categories)
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const broadCategories = useMemo(
    () => sortedCategories.filter((c) => c.is_broad === true),
    [sortedCategories]
  )
  const nicheCategories = useMemo(
    () => sortedCategories.filter((c) => c.is_broad !== true),
    [sortedCategories]
  )

  const [businessName, setBusinessName] = useState(existing?.business_name ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>(() => {
    const existingPrimary = existing?.primary_category_id ?? ''
    if (existingPrimary && broadCategories.some((c) => c.id === existingPrimary)) {
      return existingPrimary
    }
    return ''
  })
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    const primaryId = existing?.primary_category_id ?? ''
    const primary =
      primaryId ? sortedCategories.find((c) => c.id === primaryId) : undefined
    const tags = resolvePassportCategoryIds(existing ?? {}).filter((id) => id !== primaryId)
    if (!isPassportMlmBroadCategory(primary)) {
      return stripMlmNicheCategoryIds(tags, sortedCategories)
    }
    return tags
  })
  const primaryCategory = useMemo(
    () => sortedCategories.find((c) => c.id === primaryCategoryId),
    [sortedCategories, primaryCategoryId]
  )
  const visibleNicheCategories = useMemo(
    () => filterPassportNicheCategories(nicheCategories, primaryCategory),
    [nicheCategories, primaryCategory]
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(existing?.logo_url ?? '')
  const [itemFiles, setItemFiles] = useState<File[]>([])
  const [itemPreviews, setItemPreviews] = useState<string[]>(existing?.item_image_urls ?? [])
  const [websiteUrl, setWebsiteUrl] = useState(existing?.website_url ?? '')
  const [shopUrl, setShopUrl] = useState(existing?.shop_url ?? '')
  const [instagramUrl, setInstagramUrl] = useState(existing?.instagram_url ?? '')
  const [tiktokUrl, setTikTokUrl] = useState(existing?.tiktok_url ?? '')
  const [facebookUrl, setFacebookUrl] = useState(existing?.facebook_url ?? '')
  const [requiresElectricity, setRequiresElectricity] = useState(
    existing?.requires_electricity ?? false
  )
  const [socialHandle, setSocialHandle] = useState(existing?.social_handle ?? '')

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
    if (!primaryCategoryId) {
      toast.error('Pick a primary category — this fills your booth slot at markets.')
      return
    }
    setLoading(true)

    try {
      let logoUrl = existing?.logo_url ?? null
      if (logoFile) {
        logoUrl = await uploadVendorAsset(supabase, userId, logoFile, 'logo')
      }

      const uploadedItemUrls: string[] = [...(existing?.item_image_urls ?? [])]
      for (const file of itemFiles) {
        const url = await uploadVendorAsset(supabase, userId, file, 'item')
        uploadedItemUrls.push(url)
      }

      const verification = await evaluateAndScoreVendorPassport({
        business_name: businessName,
        social_handle: socialHandle,
        instagram_url: instagramUrl,
        is_verified: existing?.is_verified,
        verification_status: existing?.verification_status,
      })

      const passportData = buildPassportSavePayload({
        userId,
        businessName,
        bio,
        primaryCategoryId,
        categoryIds: [primaryCategoryId, ...categoryIds.filter((id) => id !== primaryCategoryId)],
        logoUrl,
        itemImageUrls: uploadedItemUrls,
        taxIdEncrypted: existing?.tax_id_encrypted ?? null,
        websiteUrl: normalizeUrl(websiteUrl),
        shopUrl: normalizeUrl(shopUrl),
        instagramUrl: normalizeUrl(instagramUrl),
        tiktokUrl: normalizeTikTokUrl(tiktokUrl),
        facebookUrl: normalizeUrl(facebookUrl),
        requiresElectricity,
        businessNumber: null,
        socialHandle: verification.social_handle,
        verificationStatus: verification.verification_status,
        riskScore: verification.risk_score,
      })

      const { error } = existing
        ? await supabase.from('vendor_passports').update(passportData).eq('id', existing.id)
        : await supabase.from('vendor_passports').insert(passportData)

      if (error) {
        console.error(
          'CRITICAL PASSPORT SAVE ERROR:',
          error.message,
          error.details,
          error.hint,
          error.code
        )
        throw new Error(formatSupabaseError(error))
      }

      toast.success('Passport saved! Ready to apply to events.')
      dispatchAvatarChanged(userId)
      router.push(redirectAfterSave)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Passport save failed:', err)
      toast.error(message.includes('upload') ? message : 'Failed to save passport. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="mx-auto max-w-xl pb-24">
      {/* Step indicators */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? 'bg-harvest-500' : 'bg-stone-200'
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
            {step === 2 && 'Upload your logo and product photos'}
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
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
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
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
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
                <p className="text-right text-xs text-muted-foreground">{bio.length}/500</p>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identity verification
                </p>
                <div className="space-y-1">
                  <Label htmlFor="social-handle">Primary social handle (optional)</Label>
                  <Input
                    id="social-handle"
                    placeholder="@yourbrand"
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your @username on Instagram, TikTok, or similar — not your login email. Leave blank if
                    you don&apos;t use social media.
                  </p>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    onChange={(e) => {
                      const value = e.target.value
                      setInstagramUrl(value)
                      setSocialHandle((current) => {
                        if (current.trim()) return current
                        const derived = socialHandleFromInstagram(value)
                        if (!derived) return current
                        return derived.startsWith('@') ? derived : `@${derived}`
                      })
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input
                    id="tiktok"
                    placeholder="https://tiktok.com/@yourbrand"
                    value={tiktokUrl}
                    onChange={(e) => setTikTokUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    placeholder="https://facebook.com/yourbrand"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 1: Category */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Product category *</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Pick the broader bucket that best describes your business. This is what fills your booth slot when a coordinator approves your application.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose one broad bucket. This is what consumes a category slot at markets.
                </p>
                <div className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-2">
                  {broadCategories.map((cat) => {
                    const selected = primaryCategoryId === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setPrimaryCategoryId(cat.id)
                          if (!isPassportMlmBroadCategory(cat)) {
                            setCategoryIds((prev) =>
                              stripMlmNicheCategoryIds(prev, sortedCategories)
                            )
                          }
                        }}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-sm transition',
                          selected
                            ? 'border-forest bg-forest/10 font-semibold text-forest ring-2 ring-forest/30'
                            : 'border-stone-200 bg-white text-foreground hover:border-forest/40'
                        )}
                        aria-pressed={selected}
                        role="radio"
                        aria-checked={selected}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
                {primaryCategoryId ? null : (
                  <p className="text-xs text-harvest-700">Pick a primary to continue.</p>
                )}
              </div>

              {visibleNicheCategories.length > 0 ? (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center gap-1.5">
                    <Label>Specific tags (optional)</Label>
                    <Tooltip>
                      <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Add narrower tags so shoppers can find you in search filters. These do not consume booth slots.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Help shoppers discover you. These are search tags and do not consume a category slot.
                    {isPassportMlmBroadCategory(primaryCategory)
                      ? ' MLM brand tags are shown because your primary category is Multi Level Marketer (MLM).'
                      : null}
                  </p>
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                    {visibleNicheCategories.map((cat) => {
                      const selected = categoryIds.includes(cat.id)
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            setCategoryIds((prev) => toggleCategoryId(prev, cat.id))
                          }
                          className={cn(
                            'rounded-lg border px-3 py-2 text-left text-sm transition',
                            selected
                              ? 'border-harvest-400 bg-harvest-50 font-medium text-harvest-800'
                              : 'border-stone-200 bg-white text-foreground hover:border-harvest-200'
                          )}
                          aria-pressed={selected}
                        >
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                  {categoryIds.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {categoryIds.length} tag{categoryIds.length === 1 ? '' : 's'} selected
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="requires-electricity" className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="requires-electricity"
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                    checked={requiresElectricity}
                    onChange={(e) => setRequiresElectricity(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium text-foreground">Requires electricity</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Check if your booth needs a power hookup so coordinators can plan outlet placement.
                    </span>
                  </span>
                </Label>
              </div>
            </div>
          )}

          {/* Step 2: Photos */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Business Logo</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Your full logo is shown as-is on your profile, roster, and promotional materials.
                      PNG or JPG with a transparent or white background works well.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-200 p-4 hover:border-harvest-400 transition">
                  {logoPreview ? (
                    <VendorLogo
                      src={logoPreview}
                      alt="Logo preview"
                      size="xl"
                      className="mx-auto w-full max-w-md border-dashed"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground text-center">
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
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">Photos of your actual products. Add up to 6 images to showcase what you sell at markets.</TooltipContent>
                  </Tooltip>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-200 p-4 hover:border-harvest-400 transition">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload product photos</span>
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

          {featuredProductsSlot ? (
            <div className="border-t border-stone-200 pt-6">{featuredProductsSlot}</div>
          ) : null}
        </CardContent>
      </Card>

      {/* Fixed nav — stays visible while scrolling featured products / stories below */}
      <div
        className="passport-wizard-action-bar fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label="Passport wizard navigation"
      >
        <div className="mx-auto flex max-w-xl justify-between gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              const next = step - 1
              if (next < 0) return
              setStep(next)
              resetWizardScrollAnchor()
            }}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              className="min-h-11"
              onClick={() => {
                const next = step + 1
                setStep(next)
                resetWizardScrollAnchor()
              }}
              disabled={
                (step === 0 && !businessName.trim()) ||
                (step === 1 && !primaryCategoryId)
              }
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="min-h-11"
              onClick={handleSubmit}
              disabled={loading || !businessName.trim()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Save Passport
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
