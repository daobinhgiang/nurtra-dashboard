import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import {
  BookOpen, Loader2, ChevronDown, ChevronUp, Bot, User as UserIcon, Search, X, SlidersHorizontal, Sparkles,
} from 'lucide-react'
import OpenAI from 'openai'
import { db } from '../firebase'
import type { NurtraUser, JournalEntry } from '../types'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true,
})

interface UserWithEntries {
  user: NurtraUser
  count: number
}

function formatDate(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function JournalsPage() {
  const navigate = useNavigate()
  const [usersWithEntries, setUsersWithEntries] = useState<UserWithEntries[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [userEntries, setUserEntries] = useState<Record<string, JournalEntry[]>>({})
  const [loadingEntries, setLoadingEntries] = useState<string | null>(null)
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [userFilter, setUserFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [onboardingFilter, setOnboardingFilter] = useState<string>('all')
  const [minEntriesFilter, setMinEntriesFilter] = useState<number>(1)
  const [minLevelFilter, setMinLevelFilter] = useState<number>(0)
  const [appVersionFilter, setAppVersionFilter] = useState<string>('all')
  const [onboardedWithin, setOnboardedWithin] = useState<number>(0)

  // Summarize state
  const [summarizing, setSummarizing] = useState(false)
  const [summaryResult, setSummaryResult] = useState<string | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const usersSnap = await getDocs(collection(db, 'users'))
        const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as NurtraUser))

        const BATCH = 20
        const results: UserWithEntries[] = []

        for (let i = 0; i < allUsers.length; i += BATCH) {
          const batch = allUsers.slice(i, i + BATCH)
          const counts = await Promise.all(
            batch.map(u => getCountFromServer(collection(db, 'users', u.uid, 'journalEntries')))
          )
          counts.forEach((snap, idx) => {
            const count = snap.data().count
            if (count > 0) results.push({ user: batch[idx], count })
          })
        }

        results.sort((a, b) => b.count - a.count)
        setUsersWithEntries(results)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleUser(uid: string) {
    if (expandedUser === uid) {
      setExpandedUser(null)
      return
    }
    setExpandedUser(uid)
    setExpandedEntry(null)
    if (userEntries[uid]) return

    setLoadingEntries(uid)
    try {
      const snap = await getDocs(query(
        collection(db, 'users', uid, 'journalEntries'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ))
      setUserEntries(prev => ({
        ...prev,
        [uid]: snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry)),
      }))
    } finally {
      setLoadingEntries(null)
    }
  }

  function toggleEntry(entryId: string) {
    setExpandedEntry(prev => prev === entryId ? null : entryId)
  }

  const displayName = (u: NurtraUser) => u.displayName ?? u.name ?? u.email ?? u.uid

  const availablePlatforms = useMemo(() => {
    const seen = new Set<string>()
    usersWithEntries.forEach(({ user }) => { if (user.platform) seen.add(user.platform) })
    return Array.from(seen).sort()
  }, [usersWithEntries])

  const availableAppVersions = useMemo(() => {
    const seen = new Set<string>()
    usersWithEntries.forEach(({ user }) => { if (user.appVersion) seen.add(user.appVersion) })
    return Array.from(seen).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [usersWithEntries])

  const filteredUsersWithEntries = useMemo(() => {
    const cutoff = onboardedWithin > 0 ? Date.now() - onboardedWithin * 24 * 60 * 60 * 1000 : null
    return usersWithEntries.filter(({ user, count }) => {
      const q = userFilter.trim().toLowerCase()
      if (q) {
        const name = (user.displayName ?? user.name ?? user.email ?? user.uid ?? '').toLowerCase()
        const email = (user.email ?? '').toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      if (platformFilter !== 'all') {
        const p = (user.platform ?? '').toLowerCase()
        if (p !== platformFilter.toLowerCase()) return false
      }
      if (onboardingFilter === 'yes' && !user.onboardingCompleted) return false
      if (onboardingFilter === 'no' && user.onboardingCompleted) return false
      if (appVersionFilter !== 'all' && (user.appVersion ?? '') !== appVersionFilter) return false
      if (cutoff !== null) {
        if (!user.onboardingCompletedAt) return false
        if (user.onboardingCompletedAt.toMillis() < cutoff) return false
      }
      if (count < minEntriesFilter) return false
      if (minLevelFilter > 0 && (user.currentLevel ?? 0) < minLevelFilter) return false
      return true
    })
  }, [usersWithEntries, userFilter, platformFilter, onboardingFilter, appVersionFilter, onboardedWithin, minEntriesFilter, minLevelFilter])

  async function handleSummarize() {
    setSummarizing(true)
    setSummaryError(null)
    setSummaryResult(null)
    setShowSummaryModal(true)

    try {
      // Fetch entries for any filtered user that hasn't been loaded yet
      const entriesCache = { ...userEntries }
      const toFetch = filteredUsersWithEntries.filter(({ user }) => !entriesCache[user.uid])

      if (toFetch.length > 0) {
        await Promise.all(
          toFetch.map(async ({ user }) => {
            const snap = await getDocs(query(
              collection(db, 'users', user.uid, 'journalEntries'),
              orderBy('createdAt', 'desc'),
              limit(50),
            ))
            entriesCache[user.uid] = snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry))
          })
        )
        setUserEntries(entriesCache)
      }

      // Build the prompt content from all filtered users + their entries
      const sections = filteredUsersWithEntries.map(({ user }) => {
        const entries = entriesCache[user.uid] ?? []
        if (entries.length === 0) return null
        const entriesText = entries.map((e, i) => {
          const date = formatDate(e.createdAt)
          return `  Entry ${i + 1} (${date}):\n    Title: ${e.title}\n    ${e.topic ? `Topic: ${e.topic}\n    ` : ''}Thoughts: ${e.thoughts}`
        }).join('\n\n')
        return `User: ${displayName(user)}\n${entriesText}`
      }).filter(Boolean)

      if (sections.length === 0) {
        setSummaryError('No journal entries found for the current filter.')
        return
      }

      const totalEntries = filteredUsersWithEntries.reduce((acc, { user }) => acc + (entriesCache[user.uid]?.length ?? 0), 0)
      const userCount = sections.length

      const userContent = sections.join('\n\n---\n\n')

      const response = await openai.chat.completions.create({
        model: 'o3',
        messages: [
          {
            role: 'user',
            content: `You are analyzing journal entries from a health & wellness app focused on binge eating disorder recovery. Below are journal entries from ${userCount} user${userCount !== 1 ? 's' : ''} (${totalEntries} total entries)${isFiltered ? ' — filtered by the admin' : ''}.\n\nProvide a concise, insightful summary covering:\n1. Common themes and patterns across entries\n2. Emotional tone and sentiment trends\n3. Notable struggles or progress mentioned\n4. Any topics that appear frequently\n5. Key takeaways for the care team\n\nKeep your summary clear and actionable.\n\n---\n\n${userContent}`,
          },
        ],
      })

      setSummaryResult(response.choices[0]?.message?.content ?? 'No summary returned.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred.'
      setSummaryError(message)
    } finally {
      setSummarizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading journals...</span>
      </div>
    )
  }

  const isFiltered =
    userFilter.trim().length > 0 ||
    platformFilter !== 'all' ||
    onboardingFilter !== 'all' ||
    appVersionFilter !== 'all' ||
    onboardedWithin > 0 ||
    minEntriesFilter > 1 ||
    minLevelFilter > 0

  function resetFilters() {
    setUserFilter('')
    setPlatformFilter('all')
    setOnboardingFilter('all')
    setAppVersionFilter('all')
    setOnboardedWithin(0)
    setMinEntriesFilter(1)
    setMinLevelFilter(0)
  }

  const selectClass =
    'text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <BookOpen className="w-5 h-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900">Journal Entries</h1>
        <span className="ml-2 text-sm text-slate-400">
          {isFiltered
            ? `${filteredUsersWithEntries.length} of ${usersWithEntries.length} users`
            : `${usersWithEntries.length} users`}
        </span>
        {filteredUsersWithEntries.length > 0 && (
          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isFiltered ? 'Summarize filtered' : 'Summarize all'}
          </button>
        )}
      </div>

      {usersWithEntries.length > 0 && (
        <div className="mb-5 space-y-2">
          {/* Search row */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name or email..."
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {userFilter && (
              <button
                type="button"
                onClick={() => setUserFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Characteristic filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Platform */}
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All platforms</option>
              {availablePlatforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Onboarding */}
            <select
              value={onboardingFilter}
              onChange={e => setOnboardingFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Any onboarding</option>
              <option value="yes">Onboarding complete</option>
              <option value="no">Onboarding incomplete</option>
            </select>

            {/* Min entries */}
            <select
              value={minEntriesFilter}
              onChange={e => setMinEntriesFilter(Number(e.target.value))}
              className={selectClass}
            >
              <option value={1}>Any entry count</option>
              <option value={3}>3+ entries</option>
              <option value={5}>5+ entries</option>
              <option value={10}>10+ entries</option>
              <option value={20}>20+ entries</option>
            </select>

            {/* Min level */}
            <select
              value={minLevelFilter}
              onChange={e => setMinLevelFilter(Number(e.target.value))}
              className={selectClass}
            >
              <option value={0}>Any level</option>
              <option value={2}>Level 2+</option>
              <option value={5}>Level 5+</option>
              <option value={10}>Level 10+</option>
            </select>

            {/* App version */}
            <select
              value={appVersionFilter}
              onChange={e => setAppVersionFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Any version</option>
              {availableAppVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            {/* Onboarded within */}
            <select
              value={onboardedWithin}
              onChange={e => setOnboardedWithin(Number(e.target.value))}
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
      )}

      {usersWithEntries.length === 0 ? (
        <p className="text-sm text-slate-400">No journal entries found.</p>
      ) : filteredUsersWithEntries.length === 0 ? (
        <p className="text-sm text-slate-400">No users match the current filters.</p>
      ) : (
        <div className="space-y-2">
          {filteredUsersWithEntries.map(({ user, count }) => {
            const uid = user.uid
            const isExpanded = expandedUser === uid
            const entries = userEntries[uid] ?? []

            return (
              <div key={uid} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* User row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => toggleUser(uid)}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{displayName(user)}</p>
                    {user.email && user.email !== displayName(user) && (
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                    {count} {count === 1 ? 'entry' : 'entries'}
                  </span>
                  <button
                    className="text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0 ml-1 underline underline-offset-2"
                    onClick={e => { e.stopPropagation(); navigate(`/users/${uid}`) }}
                  >
                    Profile
                  </button>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                  }
                </button>

                {/* Entries list */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {loadingEntries === uid ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Loading entries...</span>
                      </div>
                    ) : entries.length === 0 ? (
                      <p className="text-xs text-slate-400 px-4 py-4">No entries found.</p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {entries.map(entry => {
                          const entryExpanded = expandedEntry === entry.id
                          return (
                            <div key={entry.id} className="px-4 py-3">
                              <button
                                className="w-full text-left flex items-start gap-3"
                                onClick={() => toggleEntry(entry.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-slate-800">{entry.title}</span>
                                    {entry.topic && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 shrink-0">{entry.topic}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.createdAt)}</p>
                                  {!entryExpanded && (
                                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{entry.thoughts}</p>
                                  )}
                                </div>
                                {entryExpanded
                                  ? <ChevronUp className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                  : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                }
                              </button>

                              {entryExpanded && (
                                <div className="mt-3 space-y-3">
                                  <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                    <p className="text-xs font-medium text-slate-400 mb-1">Thoughts</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.thoughts}</p>
                                  </div>
                                  {entry.aiResponse && (
                                    <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
                                      <p className="text-xs font-medium text-indigo-400 mb-1 flex items-center gap-1">
                                        <Bot className="w-3 h-3" /> AI Response
                                      </p>
                                      <p className="text-sm text-indigo-900 whitespace-pre-wrap">{entry.aiResponse}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <h2 className="font-semibold text-slate-900 flex-1 text-sm">
                Journal Summary
                {isFiltered && (
                  <span className="ml-2 text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                    filtered — {filteredUsersWithEntries.length} user{filteredUsersWithEntries.length !== 1 ? 's' : ''}
                  </span>
                )}
                {!isFiltered && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {filteredUsersWithEntries.length} user{filteredUsersWithEntries.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {summarizing && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-sm">Analyzing journal entries...</p>
                </div>
              )}
              {summaryError && !summarizing && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  {summaryError}
                </div>
              )}
              {summaryResult && !summarizing && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{summaryResult}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
