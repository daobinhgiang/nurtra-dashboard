import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { NurtraUser } from '../types'
import type { Timestamp } from 'firebase/firestore'

const BATCH_SIZE = 500
const MAX_USERS = 10_000

const MS_PER_DAY = 86400 * 1000

export type CohortFilter = '30' | '90' | 'all'

export interface RetentionStats {
  totalUsers: number
  d1Count: number
  d7Count: number
  d30Count: number
  d1Rate: number
  d7Rate: number
  d30Rate: number
}

export interface RetentionTrendPoint {
  day: number
  rate: number
  eligibleUsers: number
  retainedUsers: number
}

function getRetentionBooleans(user: NurtraUser) {
  const created = user.createdAt?.toMillis()
  if (created == null) return null
  const lastMs = getLastActivityMs(user)
  return {
    d1: lastMs >= created + 1 * MS_PER_DAY,
    d7: lastMs >= created + 7 * MS_PER_DAY,
    d30: lastMs >= created + 30 * MS_PER_DAY,
  }
}

function getLastActivityMs(user: Pick<NurtraUser, 'createdAt' | 'LastLoggedIn' | 'lastOnline'>): number {
  const created = user.createdAt?.toMillis() ?? 0
  const lastLogin = user.LastLoggedIn?.toMillis() ?? 0
  const lastOnline = user.lastOnline?.toMillis() ?? 0
  return Math.max(created, lastLogin, lastOnline)
}

function isInCohort(createdAt: Timestamp | undefined, cohort: CohortFilter): boolean {
  if (!createdAt) return false
  if (cohort === 'all') return true
  const days = cohort === '30' ? 30 : 90
  const cutoff = Date.now() - days * MS_PER_DAY
  return createdAt.toMillis() >= cutoff
}

function isRetainedAtDay(user: NurtraUser, day: number): boolean {
  const created = user.createdAt?.toMillis()
  if (created == null) return false
  const lastMs = getLastActivityMs(user)
  return lastMs >= created + day * MS_PER_DAY
}

/** True if user completed at least one lesson or daily task by end of day N (since signup). */
function completedLessonOrTaskByDay(user: NurtraUser, day: number): boolean {
  const created = user.createdAt?.toMillis()
  if (created == null) return false
  const cutoff = created + day * MS_PER_DAY
  const lessonMs = user.lastLessonCompletionDate?.toMillis()
  if (lessonMs != null && lessonMs <= cutoff) return true
  const anyTaskMs = user.lastAnyTaskCompletionDayDate?.toMillis()
  if (anyTaskMs != null && anyTaskMs <= cutoff) return true
  const changeDayMs = user.lastChangeDayDate?.toMillis()
  if (changeDayMs != null && changeDayMs <= cutoff) return true
  return false
}

/** Retained at day N = returned to app by day N and completed a lesson or daily task by day N. */
function isRetainedEngagedAtDay(user: NurtraUser, day: number): boolean {
  return isRetainedAtDay(user, day) && completedLessonOrTaskByDay(user, day)
}

function computeRetention(users: NurtraUser[], cohort: CohortFilter): RetentionStats {
  const filtered = users.filter((u) => isInCohort(u.createdAt, cohort))
  let d1 = 0
  let d7 = 0
  let d30 = 0
  for (const u of filtered) {
    const retention = getRetentionBooleans(u)
    if (!retention) continue
    if (retention.d1) d1++
    if (retention.d7) d7++
    if (retention.d30) d30++
  }
  const total = filtered.length
  return {
    totalUsers: total,
    d1Count: d1,
    d7Count: d7,
    d30Count: d30,
    d1Rate: total > 0 ? (d1 / total) * 100 : 0,
    d7Rate: total > 0 ? (d7 / total) * 100 : 0,
    d30Rate: total > 0 ? (d30 / total) * 100 : 0,
  }
}

const MAX_TREND_DAY = 35

function getMaxTrendDay(_users: NurtraUser[], _cohort: CohortFilter): number {
  return MAX_TREND_DAY
}

function computeRetentionTrend(users: NurtraUser[], cohort: CohortFilter): RetentionTrendPoint[] {
  const filtered = users.filter((u) => isInCohort(u.createdAt, cohort))
  const maxDay = getMaxTrendDay(filtered, cohort)
  const trend: RetentionTrendPoint[] = []

  for (let day = 1; day <= maxDay; day++) {
    let eligibleUsers = 0
    let retainedUsers = 0

    for (const user of filtered) {
      const createdMs = user.createdAt?.toMillis()
      if (createdMs == null) continue
      const userAgeDays = Math.floor((Date.now() - createdMs) / MS_PER_DAY)
      if (userAgeDays < day) continue
      eligibleUsers++
      if (isRetainedAtDay(user, day)) retainedUsers++
    }

    if (eligibleUsers === 0) break
    trend.push({
      day,
      rate: (retainedUsers / eligibleUsers) * 100,
      eligibleUsers,
      retainedUsers,
    })
  }

  return trend
}

function computeRetentionTrendEngaged(users: NurtraUser[], cohort: CohortFilter): RetentionTrendPoint[] {
  const filtered = users.filter((u) => isInCohort(u.createdAt, cohort))
  const maxDay = getMaxTrendDay(filtered, cohort)
  const trend: RetentionTrendPoint[] = []

  for (let day = 1; day <= maxDay; day++) {
    let eligibleUsers = 0
    let retainedUsers = 0

    for (const user of filtered) {
      const createdMs = user.createdAt?.toMillis()
      if (createdMs == null) continue
      const userAgeDays = Math.floor((Date.now() - createdMs) / MS_PER_DAY)
      if (userAgeDays < day) continue
      eligibleUsers++
      if (isRetainedEngagedAtDay(user, day)) retainedUsers++
    }

    if (eligibleUsers === 0) break
    trend.push({
      day,
      rate: (retainedUsers / eligibleUsers) * 100,
      eligibleUsers,
      retainedUsers,
    })
  }

  return trend
}

export function useRetentionStats(cohort: CohortFilter) {
  const [users, setUsers] = useState<NurtraUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const usersRef = collection(db, 'users')
      let lastDoc: DocumentSnapshot | null = null
      const all: NurtraUser[] = []
      while (all.length < MAX_USERS) {
        const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
        if (lastDoc) constraints.push(startAfter(lastDoc))
        constraints.push(limit(BATCH_SIZE))
        const snap = await getDocs(query(usersRef, ...constraints))
        const batch = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as NurtraUser))
        all.push(...batch)
        if (batch.length < BATCH_SIZE) break
        lastDoc = snap.docs[snap.docs.length - 1]
      }
      setUsers(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load retention data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const stats = computeRetention(users, cohort)
  const trend = computeRetentionTrend(users, cohort)
  const trendEngaged = computeRetentionTrendEngaged(users, cohort)
  return { ...stats, trend, trendEngaged, loading, error }
}
