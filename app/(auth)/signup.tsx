import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors, Spacing, FontSizes, Radius } from '@/constants/theme';
import { Flame, Eye, EyeOff, Check, X } from 'lucide-react-native';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasMinLength = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !username.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!hasUppercase) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }
    if (!hasLowercase) {
      setError('Password must contain at least one lowercase letter.');
      return;
    }
    if (!hasMinLength) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await signUp(email.trim(), password, username.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Flame size={48} color={Colors.secondary[500]} strokeWidth={2.5} />
          </View>
          <Text style={styles.appName}>Dareon</Text>
          <Text style={styles.tagline}>Literally Just Ask.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Create your account</Text>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Pick a username"
              placeholderTextColor={Colors.neutral[400]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.neutral[400]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.neutral[400]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.neutral[400]} />
                ) : (
                  <Eye size={20} color={Colors.neutral[400]} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.requirements}>
              <RequirementRow met={hasUppercase} label="One uppercase letter" />
              <RequirementRow met={hasLowercase} label="One lowercase letter" />
              <RequirementRow met={hasMinLength} label="At least 6 characters" />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.inputFlex,
                  confirmTouched && !passwordsMatch && styles.inputError,
                ]}
                placeholder="Re-enter your password"
                placeholderTextColor={Colors.neutral[400]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={Colors.neutral[400]} />
                ) : (
                  <Eye size={20} color={Colors.neutral[400]} />
                )}
              </TouchableOpacity>
            </View>
            {confirmTouched && !passwordsMatch && (
              <Text style={styles.mismatchText}>Passwords do not match</Text>
            )}
            {confirmTouched && passwordsMatch && (
              <View style={styles.matchRow}>
                <Check size={14} color={Colors.success[400]} />
                <Text style={styles.matchText}>Passwords match</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.neutral[0]} />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.linkText}>Log in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.requirementRow}>
      {met ? (
        <View style={styles.requirementCheckActive}>
          <Check size={12} color={Colors.neutral[0]} />
        </View>
      ) : (
        <View style={styles.requirementCheckInactive}>
          <X size={12} color={Colors.neutral[500]} />
        </View>
      )}
      <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[950],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '800',
    color: Colors.neutral[0],
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.neutral[0],
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[900],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral[800],
    paddingRight: Spacing.sm,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.neutral[0],
  },
  inputError: {
    borderColor: Colors.error[500] + '60',
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  requirements: {
    gap: 6,
    marginTop: Spacing.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requirementCheckActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  requirementCheckInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.neutral[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  requirementText: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
  },
  requirementTextMet: {
    color: Colors.success[400],
    fontWeight: '600',
  },
  mismatchText: {
    fontSize: FontSizes.xs,
    color: Colors.error[400],
    marginTop: 4,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  matchText: {
    fontSize: FontSizes.xs,
    color: Colors.success[400],
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  footerText: {
    color: Colors.neutral[400],
    fontSize: FontSizes.sm,
  },
  linkText: {
    color: Colors.primary[400],
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
