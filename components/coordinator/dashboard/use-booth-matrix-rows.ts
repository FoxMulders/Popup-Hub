'use client'

import type { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import { useBoothEntities, type BoothEntity } from './use-booth-entities'

export interface BoothMatrixRow {
  id: string
  label: string
  vendor: string
  category: string
  tableCount: number | null
  paymentSummary: string
  status: keyof typeof BOOTH_STATUS_THEME
  statusLabel: string
  vendorId: string | null
  applicationId: string | null
}

function toMatrixRow(entity: BoothEntity): BoothMatrixRow {
  return {
    id: entity.id,
    label: entity.label,
    vendor: entity.vendorName,
    category: entity.productCategory,
    tableCount: entity.tableCount,
    paymentSummary: entity.paymentSummary,
    status: entity.paymentStatus,
    statusLabel: entity.statusLabel,
    vendorId: entity.vendorId,
    applicationId: entity.applicationId,
  }
}

export function useBoothMatrixRows(): BoothMatrixRow[] {
  const entities = useBoothEntities()
  return entities.map(toMatrixRow)
}
