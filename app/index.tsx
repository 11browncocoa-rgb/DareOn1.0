import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { Colors, FontSizes } from '@/constants/theme';
import { Flame } from 'lucide-react-native';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoContainer}>
          <Flame size={48} color={Colors.secondary[500]} strokeWidth={2.5} />
        </View>
        <Text style={styles.loadingText}>Dareon</Text>
        <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[950],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: FontSizes.xxxl,
    fontWeight: '800',
    color: Colors.neutral[0],
    letterSpacing: -1,
  },
});
