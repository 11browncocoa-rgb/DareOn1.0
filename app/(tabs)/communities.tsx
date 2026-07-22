import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Colors, Spacing, FontSizes, Radius } from '@/constants/theme';
import { Community, CommunityMember } from '@/types/database';
import { Avatar, EmptyState, Badge } from '@/components/ui';
import { Users, Lock, Plus, Check, ChevronLeft, UserPlus, Crown } from 'lucide-react-native';

export default function CommunitiesScreen() {
  const { profile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setCommunities(data as Community[]);

      if (profile) {
        const { data: memberships } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', profile.id);
        setJoinedIds(new Set((memberships ?? []).map((m: any) => m.community_id)));
      }
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      fetchCommunities();
    }, [fetchCommunities])
  );

  const handleCreate = async () => {
    if (!profile || !name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        description: description.trim(),
        is_private: isPrivate,
        created_by: profile.id,
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from('community_members').insert({
        community_id: data.id,
        user_id: profile.id,
        role: 'owner',
      });
      setName('');
      setDescription('');
      setIsPrivate(false);
      setShowCreate(false);
      fetchCommunities();
    }
    setCreating(false);
  };

  const handleJoin = async (communityId: string) => {
    if (!profile) return;
    const { error } = await supabase.from('community_members').insert({
      community_id: communityId,
      user_id: profile.id,
      role: 'member',
    });
    if (!error) {
      setJoinedIds((prev) => new Set(prev).add(communityId));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crews</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.newButton}>
          <Plus size={20} color={Colors.neutral[0]} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
      ) : communities.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={Colors.neutral[600]} />}
          title="No crews yet"
          subtitle="Create the first crew and start doing private challenges!"
        />
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          renderItem={({ item }) => (
            <View style={styles.communityCard}>
              <View style={styles.communityHeader}>
                <View style={styles.communityIcon}>
                  {item.is_private ? (
                    <Lock size={20} color={Colors.accent[400]} />
                  ) : (
                    <Users size={20} color={Colors.primary[400]} />
                  )}
                </View>
                <View style={styles.communityInfo}>
                  <Text style={styles.communityName}>{item.name}</Text>
                  <Text style={styles.communityDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                </View>
              </View>
              <View style={styles.communityFooter}>
                {item.is_private && <Badge label="Private" color={Colors.accent[500]} />}
                {joinedIds.has(item.id) ? (
                  <View style={styles.joinedTag}>
                    <Check size={14} color={Colors.success[400]} />
                    <Text style={styles.joinedText}>Joined</Text>
                  </View>
                ) : (
                  !item.is_private && (
                    <TouchableOpacity style={styles.joinButton} onPress={() => handleJoin(item.id)}>
                      <UserPlus size={14} color={Colors.neutral[0]} />
                      <Text style={styles.joinButtonText}>Join</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Crew</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <ChevronLeft size={24} color={Colors.neutral[400]} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Crew name"
                  placeholderTextColor={Colors.neutral[500]}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What's this crew about?"
                  placeholderTextColor={Colors.neutral[500]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity
                style={[styles.toggleRow, isPrivate && styles.toggleRowActive]}
                onPress={() => setIsPrivate(!isPrivate)}
              >
                <Lock size={18} color={isPrivate ? Colors.accent[400] : Colors.neutral[500]} />
                <Text style={[styles.toggleText, isPrivate && styles.toggleTextActive]}>
                  Private crew (invite only)
                </Text>
                <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
                  <View style={[styles.toggleKnob, isPrivate && styles.toggleKnobActive]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color={Colors.neutral[0]} />
                ) : (
                  <Text style={styles.buttonText}>Create Crew</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.neutral[0],
  },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[0],
    marginBottom: 2,
  },
  communityDesc: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
  },
  communityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinedText: {
    fontSize: FontSizes.sm,
    color: Colors.success[400],
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  joinButtonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.neutral[900],
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  inputContainer: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[300],
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.neutral[0],
  },
  textArea: {
    minHeight: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  toggleRowActive: {
    backgroundColor: Colors.accent[500] + '20',
  },
  toggleText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
  },
  toggleTextActive: {
    color: Colors.accent[300],
    fontWeight: '600',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.neutral[600],
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.accent[500],
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.neutral[200],
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  button: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + Spacing.xs,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
