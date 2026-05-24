/** Vendor receipts temporarily hidden until payment pipelines are live. */
export async function PurchaseHistory({
  userId: _userId,
  hidden = false,
}: {
  userId: string
  hidden?: boolean
}) {
  if (hidden) return null
  return null
}
