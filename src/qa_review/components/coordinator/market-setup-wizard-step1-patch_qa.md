# Step 1 wizard — promotion patch (QA → production)

Apply after QA sign-off. **Do not merge this file**; use it as a checklist.

## 1. `market-setup-wizard.tsx`

Add state:

```ts
import {
  paymentMethodsFromFlags,
  type VendorPaymentMethodKey,
} from '@/lib/wizard/vendor-payment-methods' // after promoting lib file

const [vendorPaymentMethods, setVendorPaymentMethods] = useState<VendorPaymentMethodKey[]>([
  'credit_card',
])
```

Replace imports:

```ts
import { WizardStepEventDetailsQa as WizardStepEventDetails } from '...'
// or promote files and import from @/components/coordinator/wizard/...
import { WizardStepVenueWithMapsProvider } from '...'
```

Pass to Step 1 event details:

```tsx
vendorPaymentMethods={vendorPaymentMethods}
onVendorPaymentMethodsChange={setVendorPaymentMethods}
```

## 2. Promote file paths

See `src/qa_review/MANIFEST.md` for the full copy list.
