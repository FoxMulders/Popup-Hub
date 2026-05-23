import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/stroller-clearance'

export interface HowToStep {
  title: string
  summary: string
  steps: string[]
}

export interface FaqItem {
  question: string
  answer: string
}

export const MARKET_DAY_HOW_TO: HowToStep[] = [
  {
    title: '1. Set up your event (before market day)',
    summary: 'Configure categories, fees, clearance rules, and optional raffle donations.',
    steps: [
      'Create or edit the event from your coordinator dashboard — set dates, location, and category slot limits.',
      'Connect Square if you charge booth fees, so payments and refunds run automatically.',
      'Choose a booth clearance policy (leave venue furniture vs. pack everything) and optionally describe the raffle item vendors must donate.',
      'Approve vendor applications from the event page. FCFS order is based on when each application was approved.',
    ],
  },
  {
    title: '2. Build the spatial layout',
    summary: 'Use the Spatial Planner to design booths, aisles, and doors across multiple rooms.',
    steps: [
      'Open Spatial Planner from this dashboard (or the event page).',
      'Add rooms/zones (Main Hall, Annex, Patio, etc.) — each keeps its own grid until you save.',
      'Paint aisles, entrances, exits, restrooms, and other fixtures. Drag entrance/exit doors along outer walls.',
      'Place vendors manually (Move Vendors tool) or run Auto-Plan Booths for FCFS placement.',
      'Watch for amber bottleneck warnings — walkways must stay at least 8ft wide for stroller traffic.',
      'Violet highlights show adjacent cells where “Stand Beside” neighbor matches can snap together.',
      'Save the layout when finished. Booth numbers sync to applications and check-in maps.',
    ],
  },
  {
    title: '3. Prepare check-in materials',
    summary: 'Give every approved vendor a QR code and a clear booth assignment.',
    steps: [
      'Confirm every approved vendor has a booth number on the layout.',
      'Open Check-In QR from the header nav to view or share per-vendor QR codes.',
      'Optionally print the vendor roster (event page → Print Roster) for a paper backup.',
    ],
  },
  {
    title: '4. Run live operations on market day',
    summary: 'Use the Live Operations Grid on a tablet at the floor.',
    steps: [
      'Toggle Payment (Paid / Unpaid) as vendors pay via Square or at the door.',
      'Set Load-In status: On-Time, Late, or Missed — late/missed updates vendor reliability.',
      'Checked-in status updates automatically when vendors scan their QR; you can also verify timestamps in the grid.',
      'Mark raffle donations Received or Pending (the required item text appears if you configured it on the event).',
      'Flag Early Departure with optional notes if a vendor packs up before the market ends.',
    ],
  },
  {
    title: '5. FCFS queue and neighbor preferences',
    summary: 'Review queue order and pair vendors who asked to stand beside each other.',
    steps: [
      'Open the FCFS Queue tab — vendors are sorted by approval time.',
      'Rows highlighted in violet have a matching “Stand Beside” preference with another vendor in the queue.',
      'Return to Spatial Planner to place paired vendors in adjacent violet-highlighted cells when space allows.',
    ],
  },
  {
    title: '6. Fraud-proof checkout at teardown',
    summary: 'Verify each booth is cleared with a live camera photo.',
    steps: [
      'Open the Fraud-Proof Checkout tab when vendors begin packing up.',
      'Each vendor captures a photo in-app (file uploads are not allowed).',
      'The image is watermarked with vendor name, booth number, and a UTC checkout timestamp.',
      'Review photos from the operations grid or clearance list before marking the event complete.',
    ],
  },
  {
    title: '7. If you must cancel the event',
    summary: 'Cancellation triggers refunds, vendor emails, and accountability tracking.',
    steps: [
      'From the event overview page, use Cancel Event and type CANCEL to confirm.',
      'Select a cancellation reason. Non-emergency cancellations within 7 days of start may reduce your coordinator reliability score.',
      'Paid vendors are refunded via Square automatically; failed refunds appear in the manual retry panel.',
    ],
  },
]

export const MARKET_DAY_FAQ: FaqItem[] = [
  {
    question: 'What is the stroller-safe aisle rule?',
    answer: `Walkways between booths and painted aisles must maintain at least ${MIN_STROLLER_AISLE_WIDTH_FT} feet of clearance — the ergonomic minimum for two double-strollers to pass while shoppers are stopped at booths. The planner highlights conflicting cells in amber and shows a warning card when bottlenecks are detected.`,
  },
  {
    question: 'How does Auto-Plan Booths (FCFS) work?',
    answer:
      'Auto-Plan places approved vendors in first-come, first-served order based on application approval time (not application submit time for pending apps). Booth type requests (wall, power, inside) and table-provided spacing are respected where possible. Use Standard for mixed interior layout, Outside Only for an indoor perimeter ring, or Outdoor rows for street-fair / parking-lot markets without walls.',
  },
  {
    question: 'What is “Stand Beside” and how do violet highlights work?',
    answer:
      'Vendors can enter a neighbor preference when applying (business or vendor name). The FCFS queue flags matching pairs. In the Spatial Planner, violet cells mark empty spots adjacent to a placed vendor where their matched neighbor could snap in — placement is still manual or via auto-plan; highlights are guides, not automatic pairing.',
  },
  {
    question: 'Can I have multiple rooms or zones?',
    answer:
      'Yes. Use the room tabs at the top of the Spatial Planner to add or switch zones (e.g. Main Hall vs. Patio). Each room has its own dimensions, fixtures, and vendor cells. Saving writes all rooms to the layout record; the active room is used for legacy single-room views like check-in maps until those are fully multi-room.',
  },
  {
    question: 'How do vendor reliability scores work?',
    answer:
      'Each vendor profile has a 0–100% reliability score derived from strikes: no-shows, early departures, late load-in, and poor cleanup incidents. Marking Late load-in or flagging Early Departure from the operations grid updates counts and recalculates the score. Use scores when reviewing future applications.',
  },
  {
    question: 'Why must checkout photos use the camera?',
    answer:
      'In-app camera capture prevents vendors from uploading an old or borrowed photo of a clean booth. A permanent watermark (vendor name, booth ID, UTC timestamp) is burned into the image so coordinators can verify who checked out and when.',
  },
  {
    question: 'What should vendors leave behind at teardown?',
    answer:
      'Depends on your event clearance policy. “Leave furniture” means host-provided tables and chairs stay in place; personal inventory, displays, and trash must be removed. “Pack everything” requires all furniture and stock to be cleared. Configure this on the event form.',
  },
  {
    question: 'How do QR check-ins work?',
    answer:
      'Each approved vendor gets a unique check-in link/QR. Scanning it opens a mobile-friendly page that marks them checked in and shows their booth on the event map. Coordinators can monitor check-in status in real time on the Live Operations Grid.',
  },
  {
    question: 'What happens when I cancel an event?',
    answer:
      'After you type CANCEL and confirm, the system refunds paid vendors through Square where possible, logs failures for manual retry, emails applied/approved/waitlisted vendors, and records cancellation metadata. Late non-emergency cancellations may apply a reliability penalty and a public “Recent Late Cancellation” badge on your coordinator profile.',
  },
  {
    question: 'Payment shows Unpaid but the vendor paid on Square — what do I do?',
    answer:
      'Square webhooks usually sync payment status automatically. If a row still shows Unpaid, confirm the payment in Square, then toggle Paid on the operations grid once verified. Ensure Square is connected under coordinator settings before the event.',
  },
  {
    question: 'Do I need to save the layout after every change?',
    answer:
      'Room tabs keep unsaved work in the browser session while you edit, but you should click Save on the Spatial Planner before leaving or switching devices. Market-day check-in and operations read from the last saved layout in the database.',
  },
]
