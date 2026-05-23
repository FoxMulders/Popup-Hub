'use client'

import { useState } from 'react'
import { BoothClearance } from '@/components/coordinator/booth-clearance'
import { ClearancePolicySettings } from '@/components/coordinator/clearance-policy-settings'
import { MarkClearedWithoutPhoto } from '@/components/coordinator/mark-cleared-without-photo'
import { getClearanceInstructions } from '@/lib/booth-clearance-policy'
import { CheckCircle2, Clock, ImageIcon, Info } from 'lucide-react'
import type { BoothApplication, BoothClearancePolicy, Profile, VendorPassport } from '@/types/database'

type ClearanceApp = Omit<BoothApplication, 'vendor' | 'passport' | 'category'> & {
  vendor: Profile
  passport: VendorPassport | null
  category: { name: string } | null
}

interface BoothClearanceListProps {
  eventId: string
  clearancePolicy: BoothClearancePolicy
  applications: ClearanceApp[]
}

export function BoothClearanceList({
  eventId,
  clearancePolicy: initialPolicy,
  applications: initial,
}: BoothClearanceListProps) {
  const [apps, setApps] = useState<ClearanceApp[]>(initial)
  const [policy, setPolicy] = useState<BoothClearancePolicy>(initialPolicy)

  const instructions = getClearanceInstructions(policy)
  const requiresPhoto = instructions.requiresPhoto

  function handleCleared(appId: string, photoUrl: string | null) {
    setApps((prev) =>
      prev.map((a) =>
        a.id === appId
          ? {
              ...a,
              booth_cleared: true,
              booth_cleared_photo_url: photoUrl,
              booth_cleared_at: new Date().toISOString(),
            }
          : a
      )
    )
  }

  function handleManualCleared(appId: string) {
    handleCleared(appId, null)
  }

  const clearedCount = apps.filter((a) => a.booth_cleared).length

  return (
    <div className="space-y-4">
      <ClearancePolicySettings
        eventId={eventId}
        initialPolicy={initialPolicy}
        onPolicyChange={setPolicy}
      />

      {!requiresPhoto && (
        <div className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <Info className="h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold">Photo verification not required</p>
            <p className="mt-0.5 text-green-700">{instructions.body}</p>
          </div>
        </div>
      )}

      {requiresPhoto && policy === 'pack_furniture' && (
        <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <Info className="h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="font-semibold">All tables &amp; chairs must be packed away</p>
            <p className="mt-0.5">{instructions.body}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">
            {clearedCount} / {apps.length}
          </p>
          <p className="text-xs text-gray-500">
            {requiresPhoto ? 'booths cleared with verification' : 'booths signed off'}
          </p>
        </div>
        {apps.length > 0 && (
          <div className="ml-4 flex-1 h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-green-400 transition-all"
              style={{ width: `${Math.round((clearedCount / apps.length) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {apps.map((app) => {
          const displayName = app.passport?.business_name ?? app.vendor.full_name

          return (
            <div
              key={app.id}
              className={`rounded-xl border bg-white p-4 flex items-center gap-3 transition-colors shadow-sm ${
                app.booth_cleared ? 'bg-green-50 border-green-200' : ''
              }`}
            >
              <div className="shrink-0">
                {app.booth_number != null ? (
                  <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
                    {app.booth_number}
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center text-xs">
                    —
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                {app.passport && (
                  <p className="text-xs text-gray-500 truncate">{app.vendor.full_name}</p>
                )}
                {app.booth_cleared && app.booth_cleared_at && (
                  <p className="text-[10px] text-green-600 mt-0.5">
                    Cleared at{' '}
                    {new Date(app.booth_cleared_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {!app.booth_cleared_photo_url && ' · manual sign-off'}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {app.booth_cleared ? (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Cleared
                    </span>
                    {app.booth_cleared_photo_url && (
                      <a
                        href={app.booth_cleared_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <ImageIcon className="h-3 w-3" />
                        View
                      </a>
                    )}
                    {requiresPhoto && (
                      <BoothClearance
                        application={app}
                        clearancePolicy={policy}
                        onCleared={(url) => handleCleared(app.id, url)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                    {requiresPhoto ? (
                      <BoothClearance
                        application={app}
                        clearancePolicy={policy}
                        onCleared={(url) => handleCleared(app.id, url)}
                      />
                    ) : (
                      <MarkClearedWithoutPhoto
                        applicationId={app.id}
                        onCleared={() => handleManualCleared(app.id)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {apps.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <p className="text-sm text-gray-400">No approved vendors for clearance.</p>
          </div>
        )}
      </div>
    </div>
  )
}
