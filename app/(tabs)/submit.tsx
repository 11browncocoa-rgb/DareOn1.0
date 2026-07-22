import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSizes, Radius, CHALLENGE_CATEGORIES } from '@/constants/theme';
import { ChallengeRequest } from '@/types/database';
import { EmptyState } from '@/components/ui';
import { Flame, CheckCircle, Clock, User } from 'lucide-react-native';

export default function SubmitScreen() {
  const { profile } = useAuth();
  const [view, setView] = useState<'submit' | 'browse'>('submit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [requests, setRequests] = useState<ChallengeRequest[]>([]);
  const [fetchingRequests, setFetchingRequests] = useState(false);

  const fetchRequests = useCallback(async () => {
    setFetchingRequests(true);
    const { data, error } = await supabase
      .from('challenge_requests')
      .select('*')
      .eq('status', 'open')
      .is('community_id', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setRequests(data as ChallengeRequest[]);
    }
    setFetchingRequests(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (view === 'browse') {
        fetchRequests();
      }
    }, [view, fetchRequests])
  );

  const handleSubmit = async () => {
    if (!profile) return;
    if (!title.trim()) {
      setError('Give your dare a title.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error } = await supabase.from('challenge_requests').insert({
      requester_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      category,
      status: 'open',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Your dare has been submitted! Creators can now claim it.');
      setTitle('');
      setDescription('');
      setCategory('general');
    }
  };

  const handleClaim = async (requestId: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('challenge_requests')
      .update({ status: 'claimed', claimed_by: profile.id })
      .eq('id', requestId);

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dare</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, view === 'submit' && styles.tabActive]}
          onPress={() => setView('submit')}
        >
          <Text style={[styles.tabText, view === 'submit' && styles.tabTextActive]}>Submit a Dare</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'browse' && styles.tabActive]}
          onPress={() => setView('browse')}
        >
          <Text style={[styles.tabText, view === 'browse' && styles.tabTextActive]}>Browse Dares</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {view === 'submit' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>What do you want to see?</Text>
              <Text style={styles.sectionSubtitle}>Describe a challenge and creators will make it happen.</Text>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {success && (
                <View style={styles.successBox}>
                  <CheckCircle size={20} color={Colors.success[400]} />
                  <Text style={styles.successText}>{success}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Eat a ghost pepper while reciting the alphabet backwards"
                  placeholderTextColor={Colors.neutral[500]}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add more details about the dare..."
                  placeholderTextColor={Colors.neutral[500]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {CHALLENGE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={Colors.neutral[0]} />
                ) : (
                  <Text style={styles.buttonText}>Submit Dare</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.browseContainer}>
              <Text style={styles.sectionTitle}>Open Dares</Text>
              <Text style={styles.sectionSubtitle}>Claim a dare and create a video for it.</Text>

              {fetchingRequests ? (
                <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={<Flame size={48} color={Colors.neutral[600]} />}
                  title="No open dares"
                  subtitle="Submit a dare to get the ball rolling!"
                />
              ) : (
                <View style={styles.requestList}>
                  {requests.map((req) => (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={styles.requestCategoryTag}>
                          <Text style={styles.requestCategoryText}>#{req.category}</Text>
                        </View>
                        <View style={styles.requestStatusTag}>
                          <Clock size={12} color={Colors.accent[400]} />
                          <Text style={styles.requestStatusText}>Open</Text>
                        </View>
                      </View>
                      <Text style={styles.requestTitle}>{req.title}</Text>
                      {req.description ? (
                        <Text style={styles.requestDesc} numberOfLines={3}>{req.description}</Text>
                      ) : null}
                      {profile?.is_creator ? (
                        <TouchableOpacity
                          style={styles.claimButton}
                          onPress={() => handleClaim(req.id)}
                        >
                          <Text style={styles.claimButtonText}>Claim & Record</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.creatorOnlyNote}>
                          <User size={14} color={Colors.neutral[500]} />
                          <Text style={styles.creatorOnlyText}>Creators only can claim dares</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },
  header: {
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.neutral[0],
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.neutral[900],
  },
  tabActive: {
    backgroundColor: Colors.primary[600],
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  tabTextActive: {
    color: Colors.neutral[0],
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  form: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    marginBottom: Spacing.sm,
  },
  errorBox: {
    backgroundColor: Colors.error[500] + '20',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error[500] + '40',
  },
  errorText: {
    color: Colors.error[300],
    fontSize: FontSizes.sm,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success[500] + '20',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success[500] + '40',
  },
  successText: {
    color: Colors.success[300],
    fontSize: FontSizes.sm,
    flex: 1,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[300],
    fontWeight: '500',
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
    minHeight: 100,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  categoryChipActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  categoryChipText: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  categoryChipTextActive: {
    color: Colors.neutral[0],
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + Spacing.xs,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  browseContainer: {
    gap: Spacing.sm,
  },
  requestList: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  requestCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  requestCategoryTag: {
    backgroundColor: Colors.primary[600] + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  requestCategoryText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary[300],
    textTransform: 'capitalize',
  },
  requestStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestStatusText: {
    fontSize: FontSizes.xs,
    color: Colors.accent[400],
    fontWeight: '600',
  },
  requestTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[0],
    marginBottom: Spacing.xs,
  },
  requestDesc: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  claimButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    alignItems: 'center',
  },
  claimButtonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  creatorOnlyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  creatorOnlyText: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
  },
});
