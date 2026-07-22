import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSizes, Radius } from '@/constants/theme';
import { Profile, Challenge, Report } from '@/types/database';
import { Avatar, Badge, EmptyState } from '@/components/ui';
import {
  Settings,
  Crown,
  Shield,
  LogOut,
  Edit3,
  Trophy,
  Star,
  Flag,
  X,
  Check,
  Ban,
  Flame,
  Eye,
} from 'lucide-react-native';
import { Platform } from 'react-native';

function getStatusStyle(status: string) {
  const colorMap: Record<string, string> = {
    champion: Colors.accent[400],
    active: Colors.success[400],
    beaten: Colors.neutral[500],
    pending: Colors.neutral[400],
    retired: Colors.neutral[500],
  };
  return {
    fontWeight: '700' as const,
    color: colorMap[status] ?? Colors.neutral[400],
  };
}

export default function ProfileScreen() {
  const { profile, user, signOut, updateProfile } = useAuth();
  const [view, setView] = useState<'profile' | 'settings' | 'admin'>('profile');
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [myEarnings, setMyEarnings] = useState<number>(0);
  const [creatorRank, setCreatorRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [{ data: challenges }, { data: earnings }] = await Promise.all([
      supabase.from('challenges').select('*').eq('creator_id', profile.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('viewer_earnings').select('points').eq('viewer_id', profile.id),
    ]);

    setMyChallenges((challenges as Challenge[]) ?? []);
    setMyEarnings((earnings ?? []).reduce((sum: number, e: any) => sum + (e.points ?? 0), 0));

    if (profile.is_creator) {
      const { count } = await supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true })
        .in('challenge_id', (challenges ?? []).map((c: any) => c.id));

      // Simple rank: count creators with more total interactions
      // This is a simplified version
      setCreatorRank(null);
    }

    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchProfileData();
        setEditUsername(profile.username);
        setEditBio(profile.bio);
      }
    }, [profile, fetchProfileData])
  );

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await updateProfile({ username: editUsername.trim(), bio: editBio.trim() });
    setSavingProfile(false);
    setEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary[500]} />
      </View>
    );
  }

  if (view === 'settings') {
    return (
      <SettingsView
        profile={profile}
        onBack={() => setView('profile')}
        onSignOut={handleSignOut}
      />
    );
  }

  if (view === 'admin' && profile.role === 'admin') {
    return <AdminView onBack={() => setView('profile')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setView('settings')} style={styles.iconButton}>
            <Settings size={22} color={Colors.neutral[300]} />
          </TouchableOpacity>
          {profile.role === 'admin' && (
            <TouchableOpacity onPress={() => setView('admin')} style={styles.iconButton}>
              <Shield size={22} color={Colors.secondary[400]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        <Avatar url={profile.avatar_url} username={profile.username} size={88} />
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>
        <View style={styles.badgeRow}>
          {profile.role === 'admin' && <Badge label="Admin" color={Colors.secondary[500]} />}
          {profile.is_creator && <Badge label="Creator" color={Colors.primary[500]} />}
          <Badge label="Member" color={Colors.neutral[500]} />
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
          <Edit3 size={16} color={Colors.neutral[0]} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Flame size={20} color={Colors.secondary[400]} />
          <Text style={styles.statValue}>{myChallenges.length}</Text>
          <Text style={styles.statLabel}>Challenges</Text>
        </View>
        <View style={styles.statCard}>
          <Star size={20} color={Colors.accent[400]} />
          <Text style={styles.statValue}>{myEarnings}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCard}>
          <Trophy size={20} color={Colors.primary[400]} />
          <Text style={styles.statValue}>
            {myChallenges.filter((c) => c.status === 'champion').length}
          </Text>
          <Text style={styles.statLabel}>Crowns</Text>
        </View>
      </View>

      {/* My Challenges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Challenges</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.md }} />
        ) : myChallenges.length === 0 ? (
          <Text style={styles.emptyText}>No challenges posted yet.</Text>
        ) : (
          <View style={styles.challengeList}>
            {myChallenges.map((c) => (
              <View key={c.id} style={styles.challengeCard}>
                <View style={styles.challengeCardHeader}>
                  <Text style={styles.challengeCardTitle} numberOfLines={1}>{c.title}</Text>
                  {c.status === 'champion' && <Crown size={16} color={Colors.accent[400]} />}
                </View>
                <Text style={styles.challengeCardStatus}>
                  Status: <Text style={getStatusStyle(c.status)}>{c.status}</Text>
                </Text>
                <Text style={styles.challengeCardCategory}>#{c.category}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Edit Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <X size={24} color={Colors.neutral[400]} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholderTextColor={Colors.neutral[500]}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Tell people about yourself..."
                placeholderTextColor={Colors.neutral[500]}
                maxLength={200}
              />
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? (
                <ActivityIndicator color={Colors.neutral[0]} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingsView({
  profile,
  onBack,
  onSignOut,
}: {
  profile: Profile;
  onBack: () => void;
  onSignOut: () => void;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg, paddingTop: Platform.OS === 'web' ? Spacing.lg : 50 }}>
      <View style={styles.settingsHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Account</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Email</Text>
            <Text style={styles.settingsValue}>{profile.id}</Text>
          </View>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Security</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Change Password</Text>
            <Text style={styles.settingsHint}>Coming soon</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
        <LogOut size={20} color={Colors.error[400]} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AdminView({ onBack }: { onBack: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tab, setTab] = useState<'reports' | 'users'>('reports');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    setReports((data as Report[]) ?? []);
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'reports') fetchReports();
      else fetchUsers();
    }, [tab, fetchReports, fetchUsers])
  );

  const handleResolveReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    fetchReports();
  };

  const handleDismissReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
    fetchReports();
  };

  const handleToggleBan = async (user: Profile) => {
    await supabase.from('profiles').update({ is_banned: !user.is_banned }).eq('id', user.id);
    fetchUsers();
  };

  return (
    <View style={styles.container}>
      <View style={styles.adminHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.adminTitle}>Admin Console</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.adminTabs}>
        <TouchableOpacity
          style={[styles.adminTab, tab === 'reports' && styles.adminTabActive]}
          onPress={() => setTab('reports')}
        >
          <Flag size={16} color={tab === 'reports' ? Colors.neutral[0] : Colors.neutral[500]} />
          <Text style={[styles.adminTabText, tab === 'reports' && styles.adminTabTextActive]}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.adminTab, tab === 'users' && styles.adminTabActive]}
          onPress={() => setTab('users')}
        >
          <Shield size={16} color={tab === 'users' ? Colors.neutral[0] : Colors.neutral[500]} />
          <Text style={[styles.adminTabText, tab === 'users' && styles.adminTabTextActive]}>Users</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing.xl }} />
      ) : tab === 'reports' ? (
        reports.length === 0 ? (
          <EmptyState
            icon={<Flag size={48} color={Colors.neutral[600]} />}
            title="No pending reports"
            subtitle="All clear!"
          />
        ) : (
          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: Spacing.lg }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            renderItem={({ item }) => (
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Badge label={item.target_type} color={Colors.secondary[500]} />
                  <Text style={styles.reportTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reportReason}>{item.reason}</Text>
                <View style={styles.reportActions}>
                  <TouchableOpacity style={styles.resolveButton} onPress={() => handleResolveReport(item.id)}>
                    <Check size={16} color={Colors.success[400]} />
                    <Text style={styles.resolveText}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dismissButton} onPress={() => handleDismissReport(item.id)}>
                    <X size={16} color={Colors.neutral[400]} />
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <Avatar url={item.avatar_url} username={item.username} size={40} />
                <View>
                  <Text style={styles.userName}>@{item.username}</Text>
                  <View style={styles.userBadges}>
                    {item.role === 'admin' && <Badge label="Admin" color={Colors.secondary[500]} />}
                    {item.is_creator && <Badge label="Creator" color={Colors.primary[500]} />}
                    {item.is_banned && <Badge label="Banned" color={Colors.error[500]} />}
                  </View>
                </View>
              </View>
              {item.role !== 'admin' && (
                <TouchableOpacity
                  style={[styles.banButton, item.is_banned && styles.unbanButton]}
                  onPress={() => handleToggleBan(item)}
                >
                  <Ban size={16} color={item.is_banned ? Colors.success[400] : Colors.error[400]} />
                  <Text style={[styles.banText, item.is_banned && styles.unbanText]}>
                    {item.is_banned ? 'Unban' : 'Ban'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  username: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.neutral[0],
    marginTop: Spacing.sm,
  },
  bio: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    textAlign: 'center',
    maxWidth: 280,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  editButtonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.neutral[0],
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
  },
  section: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.neutral[0],
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[500],
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  challengeList: {
    gap: Spacing.sm,
  },
  challengeCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  challengeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  challengeCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[0],
    flex: 1,
  },
  challengeCardStatus: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
    marginBottom: 2,
  },
  challengeCardCategory: {
    fontSize: FontSizes.xs,
    color: Colors.primary[400],
    textTransform: 'capitalize',
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
  saveButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + Spacing.xs,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.neutral[0],
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backText: {
    color: Colors.primary[400],
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  settingsTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  settingsSection: {
    marginBottom: Spacing.lg,
  },
  settingsSectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[400],
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  settingsLabel: {
    fontSize: FontSizes.md,
    color: Colors.neutral[200],
    fontWeight: '500',
  },
  settingsValue: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
  },
  settingsHint: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[500],
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error[500] + '15',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error[500] + '30',
    marginTop: Spacing.xl,
  },
  signOutText: {
    color: Colors.error[400],
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? Spacing.md : 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  adminTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.neutral[0],
  },
  adminTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  adminTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[900],
  },
  adminTabActive: {
    backgroundColor: Colors.primary[600],
  },
  adminTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  adminTabTextActive: {
    color: Colors.neutral[0],
  },
  reportCard: {
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reportTime: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
  },
  reportReason: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[200],
    marginBottom: Spacing.md,
  },
  reportActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success[500] + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  resolveText: {
    color: Colors.success[400],
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  dismissText: {
    color: Colors.neutral[400],
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  userName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[0],
    marginBottom: 4,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  banButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error[500] + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  unbanButton: {
    backgroundColor: Colors.success[500] + '20',
  },
  banText: {
    color: Colors.error[400],
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  unbanText: {
    color: Colors.success[400],
  },
});
