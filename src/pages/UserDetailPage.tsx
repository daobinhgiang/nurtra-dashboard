import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  getDoc,
  getCountFromServer,
  collection,
} from 'firebase/firestore'
import {
  ArrowLeft, Trophy, Utensils, BookOpen, AlertTriangle,
  CheckCircle2, Waves, GraduationCap, Smartphone, Clock,
  Mail, User, Loader2, Flame, Star,
} from 'lucide-react'
import { db } from '../firebase'
import type { NurtraUser } from '../types'
import type { Timestamp } from 'firebase/firestore'

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

interface DetailRowProps {
  label: React.ReactNode
  value: React.ReactNode
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0 gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value ?? '—'}</span>
    </div>
  )
}

interface ActivityItemProps {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  label: string
  value: number | string
  onClick?: () => void
}

function ActivityItem({ icon: Icon, iconBg, iconColor, label, value, onClick }: ActivityItemProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 ${onClick ? 'hover:bg-slate-50 cursor-pointer' : ''} transition-colors`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {onClick && <ArrowLeft className="w-4 h-4 text-slate-300 rotate-180" />}
    </Tag>
  )
}

interface SubCounts {
  foodLogs?: number
  journalEntries?: number
  bingeLogs?: number
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<NurtraUser | null>(null)
  const [subCounts, setSubCounts] = useState<SubCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    async function load() {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId!))
        if (!userSnap.exists()) {
          setError('User not found')
          return
        }
        const userData = { uid: userSnap.id, ...userSnap.data() } as NurtraUser
        setUser(userData)

        const [foodSnap, journalSnap, bingeSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users', userId!, 'foodLogs')),
          getCountFromServer(collection(db, 'users', userId!, 'journalEntries')),
          getCountFromServer(collection(db, 'users', userId!, 'bingeLogs')),
        ])
        setSubCounts({
          foodLogs: foodSnap.data().count,
          journalEntries: journalSnap.data().count,
          bingeLogs: bingeSnap.data().count,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading user...</span>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? 'User not found'}</p>
        <button onClick={() => navigate('/users')} className="mt-2 text-sm text-indigo-600 hover:underline">
          ← Back to users
        </button>
      </div>
    )
  }

  const displayName = user.displayName ?? user.name ?? 'Unknown'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to users
      </button>

      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <span className="text-indigo-700 font-bold text-xl">{getInitials(user)}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {user.platform && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                user.platform === 'iOS' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
              }`}>
                {user.platform}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user.onboardingCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {user.onboardingCompleted ? 'Onboarded' : 'Not onboarded'}
            </span>
            {user.currentLevel != null && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">
                Level {user.currentLevel}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-amber-500">
            <Star className="w-4 h-4 fill-amber-400" />
            <span className="text-sm font-bold text-slate-900">{(user.totalXP ?? 0).toLocaleString()} XP</span>
          </div>
          <span className="text-xs text-slate-400">Active {timeAgo(user.LastLoggedIn ?? user.lastOnline)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Activity */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">User Activity</h2>
            </div>
            <div className="divide-y divide-slate-50">
              <ActivityItem icon={Trophy} iconBg="bg-orange-100" iconColor="text-orange-600" label="Binges Overcome" value={user.overcomeCount ?? 0} />
              <ActivityItem icon={Waves} iconBg="bg-purple-100" iconColor="text-purple-600" label="Urge Surf Presses" value={user.urgeSurfingPressCount ?? 0} />
              <ActivityItem icon={CheckCircle2} iconBg="bg-teal-100" iconColor="text-teal-600" label="Change Days" value={user.changeDayCount ?? 0} />
              <ActivityItem icon={GraduationCap} iconBg="bg-cyan-100" iconColor="text-cyan-600" label="Lesson Days" value={user.lessonCompletionTotalDays ?? 0} />
              <ActivityItem icon={Utensils} iconBg="bg-green-100" iconColor="text-green-600" label="Food Logs" value={subCounts.foodLogs ?? '…'} />
              <ActivityItem icon={BookOpen} iconBg="bg-indigo-100" iconColor="text-indigo-600" label="Journal Entries" value={subCounts.journalEntries ?? '…'} />
              <ActivityItem icon={AlertTriangle} iconBg="bg-red-100" iconColor="text-red-600" label="Binge Logs" value={subCounts.bingeLogs ?? '…'} />
            </div>
          </div>

          {/* Streaks */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Streaks</h2>
            </div>
            <div className="divide-y divide-slate-50 px-4">
              <DetailRow label="Food Logging Streak" value={
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  {user.foodLoggingStreak ?? 0} days
                </span>
              } />
              <DetailRow label="Perfect Days" value={`${user.foodLoggingPerfectDays ?? 0} days`} />
              <DetailRow label="Lesson Streak" value={`${user.lessonCompletionStreak ?? 0} days`} />
              <DetailRow label="Any Task Streak" value={`${user.anyTaskStreak ?? 0} days`} />
              <DetailRow label="Any Task Total Days" value={`${user.anyTaskTotalDays ?? 0} days`} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Profile info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Profile</h2>
            </div>
            <div className="px-4 divide-y divide-slate-50">
              <DetailRow label={<span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Name</span>} value={displayName} />
              <DetailRow label={<span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email</span>} value={user.email} />
              <DetailRow label={<span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" />Platform</span>} value={user.platform} />
              <DetailRow label="App Version" value={user.appVersion} />
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Timestamps</h2>
            </div>
            <div className="px-4 divide-y divide-slate-50">
              <DetailRow label={<span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Joined</span>} value={formatDate(user.createdAt)} />
              <DetailRow label="Last Login" value={formatDate(user.LastLoggedIn)} />
              <DetailRow label="Last Online" value={formatDate(user.lastOnline)} />
              {user.onboardingCompleted && (
                <DetailRow label="Onboarded At" value={formatDate(user.onboardingCompletedAt)} />
              )}
              <DetailRow label="Last Food Log" value={formatDate(user.lastFoodLogDate)} />
              <DetailRow label="Last Change Day" value={formatDate(user.lastChangeDayDate)} />
            </div>
          </div>

          {/* Technical */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Technical</h2>
            </div>
            <div className="px-4 divide-y divide-slate-50">
              <DetailRow label="User ID" value={
                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{user.uid}</span>
              } />
              <DetailRow label="FCM Token" value={
                user.fcmToken
                  ? <span className="font-mono text-xs text-slate-400">{user.fcmToken.slice(0, 20)}…</span>
                  : '—'
              } />
              <DetailRow label="Timer Running" value={user.timerIsRunning ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
