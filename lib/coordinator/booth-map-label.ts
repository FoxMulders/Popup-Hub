/** Which field to render inside vendor booth shapes on the floor plan canvas. */
export type BoothMapLabelMode = 'vendor' | 'category' | 'boothId'

export const BOOTH_MAP_LABEL_OPTIONS: ReadonlyArray<{
  value: BoothMapLabelMode
  label: string
}> = [
  { value: 'vendor', label: 'Vendor name' },
  { value: 'category', label: 'Product category' },
  { value: 'boothId', label: 'Booth ID / number' },
]

export function resolveBoothMapLabelText(
  mode: BoothMapLabelMode,
  boothLabel: string,
  vendorName: string,
  productCategory: string
): string {
  switch (mode) {
    case 'vendor':
      return vendorName.trim() || '—'
    case 'category':
      return productCategory.trim() || '—'
    case 'boothId':
      return boothLabel.trim() || '—'
  }
}
