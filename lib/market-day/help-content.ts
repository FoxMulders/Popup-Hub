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
      'Create or edit the event from Markets or your event hub — set dates, location, and category slot limits.',
      'Connect Square if you charge booth fees, so payments and refunds run automatically.',
      'Choose a booth clearance policy (leave venue furniture vs. pack everything) and optionally describe the raffle item vendors must donate.',
      'Approve vendor applications from the event page. FCFS order is based on when each application was approved.',
    ],
  },
  {
    title: '2. Build the floor plan in HubGrid',
    summary: 'Design booths, aisles, and doors across multiple rooms in HubGrid.',
    steps: [
      'Open HubGrid from the site nav, Markets, or your event hub (desktop required for the full canvas).',
      'Add rooms/zones (Main Hall, Annex, Patio, etc.) — each keeps its own walls and placements until you save.',
      'Sketch walls, doors, and exits on the perimeter. Entry and exit doors can be dragged along outer walls.',
      'Place vendor booths manually, drag approved vendors from the Available pool onto booths, or run AI Auto-Arrange.',
      'Watch clearance warnings — walkways should stay at least 8′ wide for stroller traffic.',
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
      'Return to HubGrid to place paired vendors in adjacent booths when space allows.',
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
    answer: `Walkways between booths must maintain at least ${MIN_STROLLER_AISLE_WIDTH_FT} feet of clearance — the ergonomic minimum for two double-strollers to pass while shoppers are stopped at booths. HubGrid highlights tight aisles and shows clearance warnings when bottlenecks are detected.`,
  },
  {
    question: 'How does AI Auto-Arrange work?',
    answer:
      'AI Auto-Arrange repositions vendor booths and patron tables in the active room. Choose a pattern — Grid, Staggered, or Perimeter — then run Auto-Arrange from the toolbar. Perimeter modes need at least one entry and one exit on outer walls. The fairness engine respects approval order where applicable; review Cap · Cov · Fair scores and clearance warnings after each run.',
  },
  {
    question: 'What is “Stand Beside” and how do violet highlights work?',
    answer:
      'Vendors can enter a neighbor preference when applying (business or vendor name). The FCFS Queue tab flags matching pairs with violet highlights. Placement is still manual in HubGrid or via AI Auto-Arrange — the queue highlights are guides, not automatic pairing.',
  },
  {
    question: 'Can I have multiple rooms or zones?',
    answer:
      'Yes. Use the room tabs in HubGrid to add or switch zones (e.g. Main Hall vs. Patio). Each room has its own dimensions, fixtures, and booth placements. Saving writes all rooms to the layout record in one pass.',
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
      'HubGrid autosaves layout edits while you work, but click Save draft or Save layout before switching devices or closing a long session. Market-day check-in and operations read from the last saved layout in the database.',
  },
]
