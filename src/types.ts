import type { Timestamp } from 'firebase/firestore'

export interface NurtraUser {
  uid: string
  email?: string
  displayName?: string
  name?: string
  createdAt?: Timestamp
  LastLoggedIn?: Timestamp
  lastOnline?: Timestamp
  onboardingCompleted?: boolean
  onboardingCompletedAt?: Timestamp
  platform?: string
  appVersion?: string
  timerIsRunning?: boolean
  overcomeCount?: number
  urgeSurfingPressCount?: number
  totalXP?: number
  currentLevel?: number
  foodLoggingStreak?: number
  foodLoggingPerfectDays?: number
  lastFoodLogDate?: Timestamp
  lastPerfectDayDate?: Timestamp
  lessonCompletionStreak?: number
  lessonCompletionTotalDays?: number
  lastLessonCompletionDate?: Timestamp
  anyTaskStreak?: number
  anyTaskTotalDays?: number
  lastAnyTaskCompletionDayDate?: Timestamp
  changeDayCount?: number
  lastChangeDayDate?: Timestamp
  fcmToken?: string
}

export interface JournalEntry {
  id: string
  title: string
  thoughts: string
  aiResponse?: string
  topic?: string
  createdAt: Timestamp
}

export interface DashboardStats {
  totalUsers: number
  totalBingesOvercome: number
  totalUrgeSurfPresses: number
  totalChangeDays: number
  totalLessonDays: number
  totalFoodLogs: number
  totalJournalEntries: number
  totalBingeLogs: number
}
