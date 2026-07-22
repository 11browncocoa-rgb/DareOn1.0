import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ViewabilityConfig,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSizes, Radius } from '@/constants/theme';
import { ChallengeWithCreator } from '@/types/database';
import { Avatar, EmptyState } from '@/components/ui';
import { Heart, MessageCircle, Eye, Crown, Share2, Flame } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HubScreen() {
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedChallenges, setLikedChallenges] = useState<Set<string>>(new Set());

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        creator:profiles!challenges_creator_id_fkey(id, username, avatar_url)
      `)
      .in('status', ['active', 'champion'])
      .is('community_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching challenges:', error.message);
    } else if (data) {
      const enriched = await enrichWithCounts(data as ChallengeWithCreator[]);
      setChallenges(enriched);
    }
    setLoading(false);
  }, []);

  const enrichWithCounts = async (items: ChallengeWithCreator[]): Promise<ChallengeWithCreator[]> => {
    if (items.length === 0) return items;

    const challengeIds = items.map((c) => c.id);

    const [{ data: likes }, { data: views }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from('interactions').select('challenge_id').in('challenge_id', challengeIds).eq('type', 'like'),
      supabase.from('interactions').select('challenge_id').in('challenge_id', challengeIds).eq('type', 'view'),
      supabase.from('interactions').select('challenge_id').in('challenge_id', challengeIds).eq('type', 'comment'),
      supabase.from('interactions').select('challenge_id').in('challenge_id', challengeIds).eq('type', 'like').eq('viewer_id', profile?.id ?? ''),
    ]);

    const likeMap = new Map<string, number>();
    const viewMap = new Map<string, number>();
    const commentMap = new Map<string, number>();
    const myLikeSet = new Set<string>();

    likes?.forEach((i: any) => likeMap.set(i.challenge_id, (likeMap.get(i.challenge_id) ?? 0) + 1));
    views?.forEach((i: any) => viewMap.set(i.challenge_id, (viewMap.get(i.challenge_id) ?? 0) + 1));
    comments?.forEach((i: any) => commentMap.set(i.challenge_id, (commentMap.get(i.challenge_id) ?? 0) + 1));
    myLikes?.forEach((i: any) => myLikeSet.add(i.challenge_id));

    setLikedChallenges(myLikeSet);

    return items.map((c) => ({
      ...c,
      like_count: likeMap.get(c.id) ?? 0,
      view_count: viewMap.get(c.id) ?? 0,
      comment_count: commentMap.get(c.id) ?? 0,
      has_liked: myLikeSet.has(c.id),
    }));
  };

  useFocusEffect(
    useCallback(() => {
      fetchChallenges();
    }, [fetchChallenges])
  );

  const recordView = useCallback(async (challengeId: string) => {
    if (!profile) return;
    await supabase.from('interactions').insert({
      challenge_id: challengeId,
      viewer_id: profile.id,
      type: 'view',
    });
  }, [profile]);

  const handleLike = async (challengeId: string) => {
    if (!profile) return;

    if (likedChallenges.has(challengeId)) {
      setLikedChallenges((prev) => {
        const next = new Set(prev);
        next.delete(challengeId);
        return next;
      });
      await supabase
        .from('interactions')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('viewer_id', profile.id)
        .eq('type', 'like');
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, like_count: (c.like_count ?? 0) - 1, has_liked: false } : c
        )
      );
    } else {
      setLikedChallenges((prev) => {
        const next = new Set(prev);
        next.add(challengeId);
        return next;
      });
      await supabase.from('interactions').insert({
        challenge_id: challengeId,
        viewer_id: profile.id,
        type: 'like',
      });
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, like_count: (c.like_count ?? 0) + 1, has_liked: true } : c
        )
      );
    }
  };

  const viewabilityConfig: ViewabilityConfig = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
    waitForInteraction: false,
    viewAreaCoveragePercentThreshold: 50,
  };

  const onViewableItemsChanged = ({ changed }: { changed: any[] }) => {
    changed.forEach((change) => {
      if (change.item && change.isViewable) {
        setActiveIndex(change.index ?? 0);
        recordView(change.item.id);
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  if (challenges.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={<Flame size={48} color={Colors.neutral[600]} />}
          title="No challenges yet"
          subtitle="Be the first to dare someone or post a challenge!"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hub</Text>
      </View>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChallengeCard
            challenge={item}
            onLike={() => handleLike(item.id)}
            isLiked={likedChallenges.has(item.id)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

function ChallengeCard({
  challenge,
  onLike,
  isLiked,
}: {
  challenge: ChallengeWithCreator;
  onLike: () => void;
  isLiked: boolean;
}) {
  const videoUrl = challenge.video_path
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${challenge.video_path}`
    : null;
  const thumbnailUrl = challenge.thumbnail_path
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${challenge.thumbnail_path}`
    : null;

  return (
    <View style={styles.card}>
      {/* Background gradient / placeholder */}
      <View style={styles.cardBackground}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.backgroundImage} resizeMode="cover" />
        ) : (
          <View style={styles.backgroundGradient} />
        )}
        <View style={styles.overlay} />
      </View>

      {/* Content overlay */}
      <View style={styles.contentOverlay}>
        {/* Right side actions */}
        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Avatar url={challenge.creator?.avatar_url} username={challenge.creator?.username} size={48} />
            {challenge.status === 'champion' && (
              <View style={styles.crownBadge}>
                <Crown size={16} color={Colors.accent[400]} />
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.actionItem} onPress={onLike}>
            <View style={styles.actionButton}>
              <Heart
                size={32}
                color={isLiked ? Colors.secondary[500] : Colors.neutral[0]}
                fill={isLiked ? Colors.secondary[500] : 'transparent'}
              />
            </View>
            <Text style={styles.actionText}>{challenge.like_count ?? 0}</Text>
          </TouchableOpacity>
          <View style={styles.actionItem}>
            <View style={styles.actionButton}>
              <MessageCircle size={32} color={Colors.neutral[0]} />
            </View>
            <Text style={styles.actionText}>{challenge.comment_count ?? 0}</Text>
          </View>
          <View style={styles.actionItem}>
            <View style={styles.actionButton}>
              <Eye size={32} color={Colors.neutral[0]} />
            </View>
            <Text style={styles.actionText}>{challenge.view_count ?? 0}</Text>
          </View>
          <View style={styles.actionItem}>
            <View style={styles.actionButton}>
              <Share2 size={32} color={Colors.neutral[0]} />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </View>
        </View>

        {/* Bottom info */}
        <View style={styles.bottomInfo}>
          <View style={styles.creatorRow}>
            <Text style={styles.creatorName}>@{challenge.creator?.username ?? 'unknown'}</Text>
            {challenge.status === 'champion' && (
              <View style={styles.championBadge}>
                <Crown size={12} color={Colors.accent[400]} />
                <Text style={styles.championText}>Champion</Text>
              </View>
            )}
          </View>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          {challenge.description ? (
            <Text style={styles.challengeDesc} numberOfLines={3}>{challenge.description}</Text>
          ) : null}
          <View style={styles.categoryRow}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>#{challenge.category}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[950],
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.neutral[0],
    letterSpacing: -0.5,
  },
  card: {
    height: SCREEN_HEIGHT,
    width: '100%',
    backgroundColor: Colors.neutral[900],
    position: 'relative',
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundGradient: {
    flex: 1,
    backgroundColor: Colors.neutral[800],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  contentOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + Spacing.md,
  },
  actions: {
    gap: Spacing.md + Spacing.xs,
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  actionItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  crownBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: Colors.neutral[950],
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.accent[400],
  },
  bottomInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  creatorName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[0],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  championBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.accent[400] + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.accent[400] + '40',
  },
  championText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.accent[300],
  },
  challengeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.neutral[0],
    marginBottom: Spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  challengeDesc: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[200],
    marginBottom: Spacing.sm,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  categoryTag: {
    backgroundColor: Colors.primary[600] + '30',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary[500] + '40',
  },
  categoryText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary[300],
  },
});
