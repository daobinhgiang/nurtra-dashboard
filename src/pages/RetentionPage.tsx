import { useState } from 'react'
import { TrendingUp, Calendar, Loader2, RefreshCw } from 'lucide-react'
import StatCard from '../components/StatCard'
import RetentionTrendChart from '../components/RetentionTrendChart'
import { useRetentionStats, type CohortFilter } from '../hooks/useRetentionStats'

const COHORT_OPTIONS: { value: CohortFilter; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export default function RetentionPage() {
  const [cohort, setCohort] = useState<CohortFilter>('90')
  const { totalUsers, d1Count, d7Count, d30Count, d1Rate, d7Rate, d30Rate, trend, trendEngaged, loading, error } =
    useRetentionStats(cohort)

  const cards = [
    {
      icon: TrendingUp,
      label: `D1 Retention (${d1Count.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d1Rate.toFixed(1)}%`,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      icon: TrendingUp,
      label: `D7 Retention (${d7Count.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d7Rate.toFixed(1)}%`,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      icon: TrendingUp,
      label: `D30 Retention (${d30Count.toLocaleString()} of ${totalUsers.toLocaleString()} users)`,
      value: `${d30Rate.toFixed(1)}%`,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Retention</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Share of users active at least 1, 7, or 30 days after signup
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
          <span className="text-sm">Loading retention data...</span>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
          <RetentionTrendChart points={trend} />
          <RetentionTrendChart
            points={trendEngaged}
            title="Retention (return + lesson or daily task)"
            subtitle="Users who returned to the app and completed at least one lesson or daily task by that day"
          />
        </div>
      )}
    </div>
  )
}
