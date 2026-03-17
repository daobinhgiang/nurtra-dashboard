import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Search, ChevronRight, Loader2, X, SlidersHorizontal } from 'lucide-react'
import { db } from '../firebase'
import type { NurtraUser } from '../types'
import type { Timestamp } from 'firebase/firestore'

const PAGE_SIZE = 50

type SortKey = 'newest' | 'oldest' | 'recentlyActive' | 'name' | 'urgesOvercome'
type FilterKey = 'all' | 'onboarded' | 'notOnboarded'
type OnboardedWithin = 0 | 7 | 30 | 90

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
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [minLevelFilter, setMinLevelFilter] = useState<number>(0)
  const [appVersionFilter, setAppVersionFilter] = useState<string>('all')
  const [onboardedWithin, setOnboardedWithin] = useState<OnboardedWithin>(0)

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

  const availablePlatforms = useMemo(() => {
    const seen = new Set<string>()
    users.forEach((u) => { if (u.platform) seen.add(u.platform) })
    return Array.from(seen).sort()
  }, [users])

  const availableAppVersions = useMemo(() => {
    const seen = new Set<string>()
    users.forEach((u) => { if (u.appVersion) seen.add(u.appVersion) })
    return Array.from(seen).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [users])

  const filtered = useMemo(() => {
    const cutoff = onboardedWithin > 0 ? Date.now() - onboardedWithin * 24 * 60 * 60 * 1000 : null
    return users.filter((u) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const name = (u.displayName ?? u.name ?? u.email ?? u.uid ?? '').toLowerCase()
        const email = (u.email ?? '').toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      if (platformFilter !== 'all') {
        const p = (u.platform ?? '').toLowerCase()
        if (p !== platformFilter.toLowerCase()) return false
      }
      if (appVersionFilter !== 'all' && (u.appVersion ?? '') !== appVersionFilter) return false
      if (minLevelFilter > 0 && (u.currentLevel ?? 0) < minLevelFilter) return false
      if (cutoff !== null) {
        if (!u.onboardingCompletedAt) return false
        if (u.onboardingCompletedAt.toMillis() < cutoff) return false
      }
      return true
    })
  }, [users, search, platformFilter, appVersionFilter, minLevelFilter, onboardedWithin])

  const isFiltered =
    search.trim().length > 0 ||
    platformFilter !== 'all' ||
    filter !== 'all' ||
    appVersionFilter !== 'all' ||
    minLevelFilter > 0 ||
    onboardedWithin > 0

  function resetFilters() {
    setSearch('')
    setPlatformFilter('all')
    setFilter('all')
    setAppVersionFilter('all')
    setMinLevelFilter(0)
    setOnboardedWithin(0)
  }

  const selectClass =
    'text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2.5">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <span className="text-sm text-slate-500">
          {loading
            ? 'Loading...'
            : isFiltered
              ? `${filtered.length} of ${users.length}${hasMore ? '+' : ''} users`
              : `${users.length}${hasMore ? '+' : ''} users`}
        </span>
      </div>

      {/* Controls */}
      <div className="mb-5 space-y-2">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or email..."
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={selectClass}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="recentlyActive">Recently active</option>
            <option value="name">Name A–Z</option>
            <option value="urgesOvercome">Most urges overcome</option>
          </select>
        </div>

        {/* Characteristic filters row (same as Journals tab) */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All platforms</option>
            {availablePlatforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            className={selectClass}
          >
            <option value="all">Any onboarding</option>
            <option value="onboarded">Onboarding complete</option>
            <option value="notOnboarded">Onboarding incomplete</option>
          </select>

          <select
            value={minLevelFilter}
            onChange={(e) => setMinLevelFilter(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0}>Any level</option>
            <option value={2}>Level 2+</option>
            <option value={5}>Level 5+</option>
            <option value={10}>Level 10+</option>
          </select>

          <select
            value={appVersionFilter}
            onChange={(e) => setAppVersionFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">Any version</option>
            {availableAppVersions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select
            value={onboardedWithin}
            onChange={(e) => setOnboardedWithin(Number(e.target.value) as OnboardedWithin)}
            className={selectClass}
          >
            <option value={0}>Any onboard date</option>
            <option value={7}>Onboarded last 7d</option>
            <option value={30}>Onboarded last 30d</option>
            <option value={90}>Onboarded last 90d</option>
          </select>

          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2 ml-1"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading users...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm text-slate-400">
            {isFiltered ? 'No users match the current filters.' : 'No users found'}
          </p>
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
            {hasMore && !search.trim() && (
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
