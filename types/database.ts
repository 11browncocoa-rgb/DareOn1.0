export type UserRole = 'user' | 'creator' | 'admin';

export type ChallengeStatus = 'pending' | 'active' | 'champion' | 'beaten' | 'retired';
export type RequestStatus = 'open' | 'claimed' | 'fulfilled';
export type InteractionType = 'view' | 'like' | 'comment';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type TargetType = 'challenge' | 'request' | 'forum_thread' | 'forum_post' | 'profile' | 'comment';
export type CommunityRole = 'member' | 'moderator' | 'owner';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  role: UserRole;
  is_creator: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  creator_id: string;
  video_path: string | null;
  thumbnail_path: string | null;
  status: ChallengeStatus;
  community_id: string | null;
  created_at: string;
}

export interface ChallengeRequest {
  id: string;
  requester_id: string;
  title: string;
  description: string;
  category: string;
  status: RequestStatus;
  claimed_by: string | null;
  community_id: string | null;
  created_at: string;
}

export interface Interaction {
  id: string;
  challenge_id: string;
  viewer_id: string;
  type: InteractionType;
  comment_text: string | null;
  created_at: string;
}

export interface ViewerEarning {
  id: string;
  viewer_id: string;
  challenge_request_id: string;
  points: number;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: CommunityRole;
  created_at: string;
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
}

export interface ForumThread {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: TargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by: string | null;
  created_at: string;
}

export interface ChallengeWithCreator extends Challenge {
  creator?: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  like_count?: number;
  view_count?: number;
  comment_count?: number;
  has_liked?: boolean;
}

export interface ForumThreadWithAuthor extends ForumThread {
  author?: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  post_count?: number;
}

export interface ForumPostWithAuthor extends ForumPost {
  author?: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
}
