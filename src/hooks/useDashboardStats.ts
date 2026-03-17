import { useState, useEffect } from 'react'
import {
  collection,
  getAggregateFromServer,
  getCountFromServer,
  getDocs,
  query,
  orderBy,
  limit,
  sum,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { NurtraUser, DashboardStats } from '../types'

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentNewUsers, setRecentNewUsers] = useState<NurtraUser[]>([])
  const [recentlyActiveUsers, setRecentlyActiveUsers] = useState<NurtraUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const usersRef = collection(db, 'users')

        // Use split aggregate calls — combined count+multi-sum underreports totalUsers
        // due to a Firestore behaviour with sparse numeric fields.
        const [
          totalUsersCountSnap,
          bingesOvercomeAgg,
          urgeSurfAgg,
          changeDaysAgg,
          lessonDaysAgg,
          newUsersSnap,
          activeUsersSnap,
        ] = await Promise.all([
          getCountFromServer(usersRef),
          getAggregateFromServer(usersRef, { totalBingesOvercome: sum('overcomeCount') }),
          getAggregateFromServer(usersRef, { totalUrgeSurfPresses: sum('urgeSurfingPressCount') }),
          getAggregateFromServer(usersRef, { totalChangeDays: sum('changeDayCount') }),
          getAggregateFromServer(usersRef, { totalLessonDays: sum('lessonCompletionTotalDays') }),
          getDocs(query(usersRef, orderBy('createdAt', 'desc'), limit(5))),
          getDocs(query(usersRef, orderBy('LastLoggedIn', 'desc'), limit(5))),
        ])

        const totalUsers = totalUsersCountSnap.data().count
        const totalBingesOvercome = bingesOvercomeAgg.data().totalBingesOvercome ?? 0
        const totalUrgeSurfPresses = urgeSurfAgg.data().totalUrgeSurfPresses ?? 0
        const totalChangeDays = changeDaysAgg.data().totalChangeDays ?? 0
        const totalLessonDays = lessonDaysAgg.data().totalLessonDays ?? 0

        // collectionGroup queries are blocked by Firestore rules for this account.
        // Iterate per-user subcollection counts in batches instead.
        let totalFoodLogs = 0
        let totalJournalEntries = 0
        let totalBingeLogs = 0
        {
          const allUsersSnap = await getDocs(query(usersRef))
          const allUserIds = allUsersSnap.docs.map(d => d.id)
          const SUBCOLL_BATCH = 20
          for (let i = 0; i < allUserIds.length; i += SUBCOLL_BATCH) {
            const batchIds = allUserIds.slice(i, i + SUBCOLL_BATCH)
            const batchResults = await Promise.all(
              batchIds.flatMap(uid => [
                getCountFromServer(collection(db, 'users', uid, 'foodLogs')),
                getCountFromServer(collection(db, 'users', uid, 'journalEntries')),
                getCountFromServer(collection(db, 'users', uid, 'bingeLogs')),
              ])
            )
            for (let j = 0; j < batchResults.length; j += 3) {
              totalFoodLogs += batchResults[j].data().count
              totalJournalEntries += batchResults[j + 1].data().count
              totalBingeLogs += batchResults[j + 2].data().count
            }
          }
        }

        setStats({
          totalUsers,
          totalBingesOvercome,
          totalUrgeSurfPresses,
          totalChangeDays,
          totalLessonDays,
          totalFoodLogs,
          totalJournalEntries,
          totalBingeLogs,
        })

        setRecentNewUsers(
          newUsersSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as NurtraUser)),
        )
        setRecentlyActiveUsers(
          activeUsersSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as NurtraUser)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { stats, recentNewUsers, recentlyActiveUsers, loading, error }
}
