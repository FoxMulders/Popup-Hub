/** Notify vendor when a booth number is first assigned on the floor plan. */
export async function notifyVendorBoothAssigned(params: {
  vendorId: string
  applicationId: string
  eventId: string
  eventName: string
  boothNumber: number
}): Promise<void> {
  const message = `Your booth #${params.boothNumber} is on the map for ${params.eventName}. Open your application for load-in details.`

  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: params.vendorId,
      type: 'application_approved',
      message,
      metadata: {
        application_id: params.applicationId,
        event_id: params.eventId,
        booth_number: params.boothNumber,
        booth_assigned: true,
      },
      send_sms: false,
    }),
  })
}
