'use client'

import { useBoothMatrixRows } from './use-booth-matrix-rows'
import { useMarketManagement } from './market-management-context'

/** Screen-reader-only tabular fallback — visible matrix lives in {@link BoothMatrixPanel}. */
export function BoothMatrixA11yTable() {
  const rows = useBoothMatrixRows()
  const { focusBooth, selectedBoothId } = useMarketManagement()

  if (rows.length === 0) return null

  return (
    <div className="sr-only" aria-hidden={false}>
      <h3>Booth matrix (screen reader)</h3>
      <table>
        <caption>
          Tabular fallback for floor plan booth assignments and payment status
        </caption>
        <thead>
          <tr>
            <th scope="col">Booth</th>
            <th scope="col">Vendor</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Coordinates (ft)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              aria-current={selectedBoothId === row.id ? 'true' : undefined}
            >
              <th scope="row">
                <button type="button" onClick={() => focusBooth(row.id)}>
                  {row.label}
                </button>
              </th>
              <td>{row.vendor}</td>
              <td>{row.category}</td>
              <td>{row.statusLabel}</td>
              <td>
                {row.x}′ × {row.y}′
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
