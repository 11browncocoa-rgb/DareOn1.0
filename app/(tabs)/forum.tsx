import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Colors, Spacing, FontSizes, Radius } from '@/constants/theme';
import { ForumCategory, ForumThread, ForumThreadWithAuthor, ForumPostWithAuthor } from '@/types/database';
import { Avatar, EmptyState } from '@/components/ui';
import { MessageCircle, ChevronLeft, Send, Flame } from 'lucide-react-native';

type ViewMode =
  | { type: 'categories' }
  | { type: 'threads'; categoryId: string; categoryName: string }
  | { type: 'posts'; threadId: string; threadTitle: string };

export default function ForumScreen() {
  const [mode, setMode] = useState<ViewMode>({ type: 'categories' });

  if (mode.type === 'categories') {
    return <CategoryList onCategorySelect={(cat) => setMode({ type: 'threads', categoryId: cat.id, categoryName: cat.name })} />;
  }

  if (mode.type === 'threads') {
    return (
      <ThreadList
        categoryId={mode.categoryId}
        categoryName={mode.categoryName}
        onBack={() => setMode({ type: 'categories' })}
        onThreadSelect={(thread) => setMode({ type: 'posts', threadId: thread.id, threadTitle: thread.title })}
      />
    );
  }

  return (
    <PostList
      threadId={mode.threadId}
      threadTitle={mode.threadTitle}
      onBack={() => setMode({ type: 'threads', categoryId: '', categoryName: '' })}
    />
  );
}

function CategoryList({ onCategorySelect }: { onCategorySelect: (cat: ForumCategory) => void }) {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('forum_categories')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data) {
          setCategories(data as ForumCategory[]);
        }
        setLoading(false);
      })();
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Forum</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={48} color={Colors.neutral[600]} />}
          title="No categories yet"
          subtitle="Check back soon!"
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.categoryCard} onPress={() => onCategorySelect(item)}>
              <View style={styles.categoryIcon}>
                <MessageCircle size={24} color={Colors.primary[400]} />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.categoryDesc} numberOfLines={2}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function ThreadList({
  categoryId,
  categoryName,
  onBack,
  onThreadSelect,
}: {
  categoryId: string;
  categoryName: string;
  onBack: () => void;
  onThreadSelect: (thread: ForumThread) => void;
}) {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<ForumThreadWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forum_threads')
      .select(`
        *,
        author:profiles!forum_threads_author_id_fkey(id, username, avatar_url)
      `)
      .eq('category_id', categoryId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const threadIds = (data as ForumThreadWithAuthor[]).map((t) => t.id);
      let postCounts = new Map<string, number>();
      if (threadIds.length > 0) {
        const { data: posts } = await supabase
          .from('forum_posts')
          .select('thread_id')
          .in('thread_id', threadIds);
        posts?.forEach((p: any) => postCounts.set(p.thread_id, (postCounts.get(p.thread_id) ?? 0) + 1));
      }
      setThreads((data as ForumThreadWithAuthor[]).map((t) => ({ ...t, post_count: postCounts.get(t.id) ?? 0 })));
    }
    setLoading(false);
  }, [categoryId]);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads])
  );

  const handleCreateThread = async () => {
    if (!profile || !title.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('forum_threads').insert({
      category_id: categoryId,
      author_id: profile.id,
      title: title.trim(),
      body: body.trim(),
    });
    setSubmitting(false);
    if (!error) {
      setTitle('');
      setBody('');
      setShowForm(false);
      fetchThreads();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.neutral[0]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{categoryName}</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} style={styles.newButton}>
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Thread title"
            placeholderTextColor={Colors.neutral[500]}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What's on your mind?"
            placeholderTextColor={Colors.neutral[500]}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.button} onPress={handleCreateThread} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={Colors.neutral[0]} />
            ) : (
              <Text style={styles.buttonText}>Post Thread</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={<Flame size={48} color={Colors.neutral[600]} />}
          title="No threads yet"
          subtitle="Start the conversation!"
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.threadCard} onPress={() => onThreadSelect(item)}>
              <View style={styles.threadHeader}>
                <Avatar url={item.author?.avatar_url} username={item.author?.username} size={32} />
                <Text style={styles.threadAuthor}>@{item.author?.username ?? 'unknown'}</Text>
              </View>
              <Text style={styles.threadTitle}>{item.title}</Text>
              {item.body ? <Text style={styles.threadBody} numberOfLines={2}>{item.body}</Text> : null}
              <View style={styles.threadFooter}>
                <MessageCircle size={14} color={Colors.neutral[500]} />
                <Text style={styles.threadMeta}>{item.post_count ?? 0} replies</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function PostList({
  threadId,
  threadTitle,
  onBack,
}: {
  threadId: string;
  threadTitle: string;
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<ForumPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        author:profiles!forum_posts_author_id_fkey(id, username, avatar_url)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setPosts(data as ForumPostWithAuthor[]);
    }
    setLoading(false);
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const handleReply = async () => {
    if (!profile || !reply.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('forum_posts').insert({
      thread_id: threadId,
      author_id: profile.id,
      body: reply.trim(),
    });
    setSubmitting(false);
    if (!error) {
      setReply('');
      fetchPosts();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.neutral[0]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{threadTitle}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={48} color={Colors.neutral[600]} />}
          title="No replies yet"
          subtitle="Be the first to reply!"
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                <Avatar url={item.author?.avatar_url} username={item.author?.username} size={32} />
                <View>
                  <Text style={styles.postAuthor}>@{item.author?.username ?? 'unknown'}</Text>
                  <Text style={styles.postTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <Text style={styles.postBody}>{item.body}</Text>
            </View>
          )}
        />
      )}

      <View style={styles.replyBar}>
        <TextInput
          style={styles.replyInput}
          placeholder="Write a reply..."
          placeholderTextColor={Colors.neutral[500]}
          value={reply}
          onChangeText={setReply}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleReply} disabled={submitting || !reply.trim()}>
          <Send size={20} color={Colors.neutral[0]} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.neutral[0],
    flex: 1,
  },
  backButton: {
    padding: Spacing.xs,
  },
  newButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  newButtonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary[600] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[0],
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
  },
  form: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  textArea: {
    minHeight: 80,
  },
  button: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  threadCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  threadAuthor: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    fontWeight: '500',
  },
  threadTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[0],
    marginBottom: Spacing.xs,
  },
  threadBody: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[300],
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  threadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  threadMeta: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
  },
  postCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  postAuthor: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[200],
    fontWeight: '600',
  },
  postTime: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
  },
  postBody: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[300],
    lineHeight: 20,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.neutral[900],
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[800],
  },
  replyInput: {
    flex: 1,
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.neutral[0],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
