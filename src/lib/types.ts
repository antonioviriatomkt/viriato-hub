import type { Tables } from './database.types'

export type Role = 'admin' | 'member' | 'pending'
export type MeetingStatus = 'planned' | 'done' | 'cancelled'

export type Profile = Tables<'profiles'>
export type Team = Tables<'teams'>
export type TeamMember = Tables<'team_members'>
export type Meeting = Tables<'meetings'>
export type MeetingNote = Tables<'meeting_notes'>
export type MeetingLogEntry = Tables<'meeting_log'>

export type NameRef = { full_name: string | null; email?: string } | null

export type MeetingListItem = Meeting & {
  creator: NameRef
  meeting_notes: { count: number }[]
}

export type MeetingDetail = Meeting & { creator: NameRef }
export type NoteWithAuthor = MeetingNote & { author: NameRef }
export type LogWithActor = MeetingLogEntry & { actor: NameRef }
export type MemberWithProfile = TeamMember & { profile: Profile | null }
