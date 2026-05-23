import { Zap } from 'lucide-react'

export function BoothTypeLegend() {
  return (
    <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-3 shadow-sm">
      <p className="w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Booth Types
      </p>
      <div className="flex items-center gap-2">
        <div className="h-5 w-8 rounded border-2 border-amber-700 bg-amber-50" />
        <span className="text-xs text-gray-700">Wall Space</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-5 w-8 rounded border-2 border-gray-300 bg-white" />
        <span className="text-xs text-gray-700">Inside Space</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-5 w-8 rounded border-2 border-yellow-400 bg-yellow-50 flex items-center justify-center">
          <Zap className="h-3 w-3 text-yellow-500" />
        </div>
        <span className="text-xs text-gray-700">Power Available</span>
      </div>
    </div>
  )
}
