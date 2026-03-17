import { useState } from 'react'
import { TrendingDown, Calendar, Loader2, RefreshCw } from 'lucide-react'
import StatCard from '../components/StatCard'
import { useRetentionStats, type CohortFilter } from '../hooks/useRetentionStats'

const COHORT_OPTIONS: { value: CohortFilter; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export default function ChurnPage() {
  const [cohort, setCohort] = useState<CohortFilter>('90')
  const { totalUsers, d1Count, d7Count, d30Count, d1Rate, d7Rate, d30Rate, loading, error } =
    useRetentionStats(cohort)

  const d1ChurnCount = Math.max(totalUsers - d1Count, 0)
  const d7ChurnCount = Math.max(totalUsers - d7Count, 0)
  const d30ChurnCount = Math.max(totalUsers - d30Count, 0)
  const d1ChurnRate = Math.max(100 - d1Rate, 0)
  const d7ChurnRate = Math.max(100 - d7Rate, 0)
  const d30ChurnRate = Math.max(100 - d30Rate, 0)

  const cards = [
    {
      icon: TrendingDown,
      label: `D1 Churn (${d1ChurnCount.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d1ChurnRate.toFixed(1)}%`,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    },
    {
      icon: TrendingDown,
      label: `D7 Churn (${d7ChurnCount.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d7ChurnRate.toFixed(1)}%`,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      icon: TrendingDown,
      label: `D30 Churn (${d30ChurnCount.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d30ChurnRate.toFixed(1)}%`,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Churn</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Share of users inactive by day 1, 7, or 30 after signup
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value as CohortFilter)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {COHORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Signups: {opt.label}
                </option>
              ))}
            </select>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && totalUsers === 0 ? (
        <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading churn data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}
