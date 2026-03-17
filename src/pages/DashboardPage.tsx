import { useNavigate } from 'react-router-dom'
import {
  Trophy, Users, Utensils, BookOpen, GraduationCap,
  AlertTriangle, CheckCircle2, Waves, MessageCircle,
  Clock, UserPlus, RefreshCw,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { useDashboardStats } from '../hooks/useDashboardStats'
import type { NurtraUser } from '../types'
import type { Timestamp } from 'firebase/firestore'

function timeAgo(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  const seconds = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getInitials(user: NurtraUser): string {
  const name = user.displayName ?? user.name ?? user.email ?? '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

function UserRow({ user, onClick }: { user: NurtraUser; onClick: () => void }) {
  const name = user.displayName ?? user.name ?? 'Unknown'
  const initials = getInitials(user)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
        <span className="text-indigo-700 font-semibold text-sm">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {user.platform && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.platform === 'iOS'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-green-50 text-green-600'
          }`}>
            {user.platform}
          </span>
        )}
        <span className="text-xs text-slate-400">
          {timeAgo(user.LastLoggedIn ?? user.lastOnline)}
        </span>
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { stats, recentNewUsers, recentlyActiveUsers, loading, error } = useDashboardStats()

  const statCards = [
    {
      icon: MessageCircle,
      label: 'Unread Messages',
      value: '—',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      icon: Users,
      label: 'Total Users',
      value: stats?.totalUsers ?? '—',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      onClick: () => navigate('/users'),
    },
    {
      icon: Trophy,
      label: 'Binges Overcome',
      value: stats?.totalBingesOvercome ?? '—',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      icon: Utensils,
      label: 'Total Food Logs',
      value: stats?.totalFoodLogs ?? '—',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      icon: BookOpen,
      label: 'Total Journaling',
      value: stats?.totalJournalEntries ?? '—',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      icon: GraduationCap,
      label: 'Session Completions',
      value: stats?.totalLessonDays ?? '—',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      icon: AlertTriangle,
      label: 'Total Binge Logs',
      value: stats?.totalBingeLogs ?? '—',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      icon: CheckCircle2,
      label: 'Daily Tasks Completed',
      value: stats?.totalChangeDays ?? '—',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      icon: Waves,
      label: 'Urge Surf Presses',
      value: stats?.totalUrgeSurfPresses ?? '—',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of Nurtra user activity</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <section className="mb-8">
        <div className="grid grid-cols-3 gap-3">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* User Lists */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent New Users */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Recent New Users</h2>
          </div>
          {recentNewUsers.length === 0 && !loading ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No users yet</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentNewUsers.map((u) => (
                <UserRow key={u.uid} user={u} onClick={() => navigate(`/users/${u.uid}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Recently Active Users */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Recently Active</h2>
          </div>
          {recentlyActiveUsers.length === 0 && !loading ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No users yet</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentlyActiveUsers.map((u) => (
                <UserRow key={u.uid} user={u} onClick={() => navigate(`/users/${u.uid}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
