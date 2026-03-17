import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  type QueryConstraint,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { Search, ChevronRight, Loader2 } from 'lucide-react'
import { db } from '../firebase'
import type { NurtraUser } from '../types'
import type { Timestamp } from 'firebase/firestore'

const PAGE_SIZE = 50

type SortKey = 'newest' | 'oldest' | 'recentlyActive' | 'name' | 'urgesOvercome'
type FilterKey = 'all' | 'onboarded' | 'notOnboarded'

function timeAgo(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  const seconds = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function activityScore(user: NurtraUser): number {
  return (user.overcomeCount ?? 0) + (user.urgeSurfingPressCount ?? 0) + (user.changeDayCount ?? 0) + (user.totalXP ?? 0) / 100
}

function getInitials(user: NurtraUser): string {
  const name = user.displayName ?? user.name ?? user.email ?? '?'
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

export default function UsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<NurtraUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [filter, setFilter] = useState<FilterKey>('all')

  const sortFields: Record<SortKey, [string, 'asc' | 'desc']> = {
    newest: ['createdAt', 'desc'],
    oldest: ['createdAt', 'asc'],
    recentlyActive: ['LastLoggedIn', 'desc'],
    name: ['displayName', 'asc'],
    urgesOvercome: ['overcomeCount', 'desc'],
  }

  const loadUsers = useCallback(async (reset = false) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const usersRef = collection(db, 'users')
      const [sortField, sortDir] = sortFields[sort]
      const constraints: QueryConstraint[] = [orderBy(sortField, sortDir)]

      if (filter === 'onboarded') constraints.push(where('onboardingCompleted', '==', true))
      if (filter === 'notOnboarded') constraints.push(where('onboardingCompleted', '==', false))
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc))
      constraints.push(limit(PAGE_SIZE))

      const snap = await getDocs(query(usersRef, ...constraints))
      const fetched = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as NurtraUser))

      setUsers((prev) => (reset ? fetched : [...prev, ...fetched]))
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLastDoc(null)
    loadUsers(true)
  }, [sort, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase()
        return (
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.displayName ?? '').toLowerCase().includes(q) ||
          (u.name ?? '').toLowerCase().includes(q)
        )
      })
    : users

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {loading ? 'Loading...' : `${users.length}${hasMore ? '+' : ''} users`}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All users</option>
          <option value="onboarded">Onboarded</option>
          <option value="notOnboarded">Not onboarded</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="recentlyActive">Recently active</option>
          <option value="name">Name A–Z</option>
          <option value="urgesOvercome">Most urges overcome</option>
        </select>
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading users...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm text-slate-400">No users found</p>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {filtered.map((user) => {
                const name = user.displayName ?? user.name ?? 'Unknown'
                const score = Math.round(activityScore(user))
                return (
                  <button
                    key={user.uid}
                    onClick={() => navigate(`/users/${user.uid}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-700 font-semibold text-sm">{getInitials(user)}</span>
                      </div>
                      {score > 0 && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-400 flex items-center justify-center">
                          <span className="text-white text-[9px] font-bold">{score > 99 ? '99+' : score}</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {user.platform && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.platform === 'iOS' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {user.platform}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.onboardingCompleted
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {user.onboardingCompleted ? 'Onboarded' : 'Pending'}
                      </span>
                      <span className="text-xs text-slate-400 w-16 text-right">
                        {timeAgo(user.LastLoggedIn ?? user.lastOnline)}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                )
              })}
            </div>

            {/* Load more */}
            {hasMore && !search && (
              <div className="border-t border-slate-50 px-5 py-4 flex justify-center">
                <button
                  onClick={() => loadUsers(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-700 disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMore ? 'Loading...' : 'Load more users'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
