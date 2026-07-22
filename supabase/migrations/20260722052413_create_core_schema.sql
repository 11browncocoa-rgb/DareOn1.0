/*
# Dareon Core Schema

Creates the foundational tables for the Dareon challenge-based social video app.

## New Tables

1. **profiles** - Extends auth.users with app-specific fields (username, avatar, bio, role).
2. **communities** - User-created groups, public or private, for private challenges.
3. **community_members** - Join table linking users to communities with roles.
4. **challenges** - Video challenges posted by creators. Each has a status that tracks the "champion" mechanic.
5. **challenge_requests** - Dares submitted by viewers that creators can claim and fulfill.
6. **interactions** - Likes, views, and comments on challenges. Drives champion ranking and viewer rewards.
7. **viewer_earnings** - Points accrued to viewers based on interactions with challenges spawned from their requests.
8. **forum_categories** - Top-level forum sections.
9. **forum_threads** - Discussion threads within categories.
10. **forum_posts** - Replies within threads.
11. **reports** - Content moderation reports for the admin console.

## Security

- RLS enabled on every table.
- Owner-scoped CRUD policies for user-owned data.
- Membership-scoped policies for community data.
- Public read access where appropriate (challenges, profiles, forum).
- All policies use auth.uid() for ownership checks.

## Notes

1. The founder account (cummingslennyy@gmail.com) is seeded as admin in a follow-up migration.
2. Viewer earnings are points-based (no real money).
3. The champion mechanic is handled via SQL functions in a follow-up migration.
*/

-- ============================================================
-- TABLE CREATION (all tables first, policies after)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin')),
  is_creator boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  video_path text,
  thumbnail_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'champion', 'beaten', 'retired')),
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'fulfilled')),
  claimed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('view', 'like', 'comment')),
  comment_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS viewer_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_request_id uuid NOT NULL REFERENCES challenge_requests(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text DEFAULT 'message-circle',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('challenge', 'request', 'forum_thread', 'forum_post', 'profile', 'comment')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_all_profiles" ON profiles;
CREATE POLICY "read_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- COMMUNITIES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_communities" ON communities;
CREATE POLICY "read_communities" ON communities FOR SELECT
  TO authenticated USING (
    is_private = false
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = communities.id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_communities" ON communities;
CREATE POLICY "insert_communities" ON communities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_own_communities" ON communities;
CREATE POLICY "update_own_communities" ON communities FOR UPDATE
  TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "admin_update_communities" ON communities;
CREATE POLICY "admin_update_communities" ON communities FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_communities" ON communities;
CREATE POLICY "delete_own_communities" ON communities FOR DELETE
  TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "admin_delete_communities" ON communities;
CREATE POLICY "admin_delete_communities" ON communities FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- COMMUNITY MEMBERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_community_members" ON community_members;
CREATE POLICY "read_community_members" ON community_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_members.community_id
      AND (c.is_private = false OR c.id IN (
        SELECT cm2.community_id FROM community_members cm2 WHERE cm2.user_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "insert_community_members" ON community_members;
CREATE POLICY "insert_community_members" ON community_members FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_members.community_id AND c.is_private = false
    )
  );

DROP POLICY IF EXISTS "update_community_members" ON community_members;
CREATE POLICY "update_community_members" ON community_members FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'moderator')
    )
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'moderator')
    )
  );

DROP POLICY IF EXISTS "delete_community_members" ON community_members;
CREATE POLICY "delete_community_members" ON community_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );

-- ============================================================
-- CHALLENGES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_challenges" ON challenges;
CREATE POLICY "read_challenges" ON challenges FOR SELECT
  TO authenticated USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = challenges.community_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_challenges" ON challenges;
CREATE POLICY "insert_challenges" ON challenges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('creator', 'admin') AND p.is_banned = false)
  );

DROP POLICY IF EXISTS "update_own_challenges" ON challenges;
CREATE POLICY "update_own_challenges" ON challenges FOR UPDATE
  TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_challenges" ON challenges;
CREATE POLICY "admin_update_challenges" ON challenges FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_challenges" ON challenges;
CREATE POLICY "delete_own_challenges" ON challenges FOR DELETE
  TO authenticated USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_challenges" ON challenges;
CREATE POLICY "admin_delete_challenges" ON challenges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- CHALLENGE REQUESTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_challenge_requests" ON challenge_requests;
CREATE POLICY "read_challenge_requests" ON challenge_requests FOR SELECT
  TO authenticated USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = challenge_requests.community_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_challenge_requests" ON challenge_requests;
CREATE POLICY "insert_challenge_requests" ON challenge_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_own_challenge_requests" ON challenge_requests;
CREATE POLICY "update_own_challenge_requests" ON challenge_requests FOR UPDATE
  TO authenticated USING (requester_id = auth.uid()) WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "creator_claim_challenge_requests" ON challenge_requests;
CREATE POLICY "creator_claim_challenge_requests" ON challenge_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('creator', 'admin') AND p.is_banned = false)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('creator', 'admin') AND p.is_banned = false)
  );

DROP POLICY IF EXISTS "admin_update_requests" ON challenge_requests;
CREATE POLICY "admin_update_requests" ON challenge_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_challenge_requests" ON challenge_requests;
CREATE POLICY "delete_own_challenge_requests" ON challenge_requests FOR DELETE
  TO authenticated USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_challenge_requests" ON challenge_requests;
CREATE POLICY "admin_delete_challenge_requests" ON challenge_requests FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- INTERACTIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_interactions" ON interactions;
CREATE POLICY "read_interactions" ON interactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_interactions" ON interactions;
CREATE POLICY "insert_interactions" ON interactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "delete_own_interactions" ON interactions;
CREATE POLICY "delete_own_interactions" ON interactions FOR DELETE
  TO authenticated USING (viewer_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_interactions" ON interactions;
CREATE POLICY "admin_delete_interactions" ON interactions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- VIEWER EARNINGS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_viewer_earnings" ON viewer_earnings;
CREATE POLICY "read_viewer_earnings" ON viewer_earnings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_viewer_earnings" ON viewer_earnings;
CREATE POLICY "insert_viewer_earnings" ON viewer_earnings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "admin_update_viewer_earnings" ON viewer_earnings;
CREATE POLICY "admin_update_viewer_earnings" ON viewer_earnings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- FORUM CATEGORIES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_forum_categories" ON forum_categories;
CREATE POLICY "read_forum_categories" ON forum_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_forum_categories" ON forum_categories;
CREATE POLICY "admin_insert_forum_categories" ON forum_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_forum_categories" ON forum_categories;
CREATE POLICY "admin_update_forum_categories" ON forum_categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_forum_categories" ON forum_categories;
CREATE POLICY "admin_delete_forum_categories" ON forum_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- FORUM THREADS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_forum_threads" ON forum_threads;
CREATE POLICY "read_forum_threads" ON forum_threads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_forum_threads" ON forum_threads;
CREATE POLICY "insert_forum_threads" ON forum_threads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "update_own_forum_threads" ON forum_threads;
CREATE POLICY "update_own_forum_threads" ON forum_threads FOR UPDATE
  TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_forum_threads" ON forum_threads;
CREATE POLICY "admin_update_forum_threads" ON forum_threads FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_forum_threads" ON forum_threads;
CREATE POLICY "delete_own_forum_threads" ON forum_threads FOR DELETE
  TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_forum_threads" ON forum_threads;
CREATE POLICY "admin_delete_forum_threads" ON forum_threads FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- FORUM POSTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "read_forum_posts" ON forum_posts;
CREATE POLICY "read_forum_posts" ON forum_posts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_forum_posts" ON forum_posts;
CREATE POLICY "insert_forum_posts" ON forum_posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "update_own_forum_posts" ON forum_posts;
CREATE POLICY "update_own_forum_posts" ON forum_posts FOR UPDATE
  TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_forum_posts" ON forum_posts;
CREATE POLICY "admin_update_forum_posts" ON forum_posts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_forum_posts" ON forum_posts;
CREATE POLICY "delete_own_forum_posts" ON forum_posts FOR DELETE
  TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_forum_posts" ON forum_posts;
CREATE POLICY "admin_delete_forum_posts" ON forum_posts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- REPORTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "insert_reports" ON reports;
CREATE POLICY "insert_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "read_own_reports" ON reports;
CREATE POLICY "read_own_reports" ON reports FOR SELECT
  TO authenticated USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_reports" ON reports;
CREATE POLICY "admin_read_reports" ON reports FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_reports" ON reports;
CREATE POLICY "admin_update_reports" ON reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_reports" ON reports;
CREATE POLICY "admin_delete_reports" ON reports FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communities_private ON communities(is_private);
CREATE INDEX IF NOT EXISTS idx_communities_created ON communities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_community ON challenges(community_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON challenge_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON challenge_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON challenge_requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_created ON challenge_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_challenge ON interactions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_interactions_viewer ON interactions(viewer_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_viewer ON viewer_earnings(viewer_id);
CREATE INDEX IF NOT EXISTS idx_earnings_request ON viewer_earnings(challenge_request_id);
CREATE INDEX IF NOT EXISTS idx_threads_category ON forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_threads_author ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_threads_created ON forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- ============================================================
-- SEED FORUM CATEGORIES
-- ============================================================
INSERT INTO forum_categories (name, description, icon) VALUES
  ('General', 'Talk about anything Dareon-related.', 'message-circle'),
  ('Challenge Ideas', 'Share and brainstorm new challenge ideas.', 'flame'),
  ('Creator Tips', 'Tips and tricks for creating great challenge videos.', 'video'),
  ('Community Events', 'Announcements and event planning.', 'calendar'),
  ('Bug Reports', 'Report bugs and issues with the app.', 'bug')
ON CONFLICT (name) DO NOTHING;