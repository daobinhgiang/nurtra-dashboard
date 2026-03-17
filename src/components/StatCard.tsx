import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  iconBg: string
  iconColor: string
  onClick?: () => void
}

export default function StatCard({ icon: Icon, label, value, iconBg, iconColor, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-slate-100 text-left transition-all ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  )
}
