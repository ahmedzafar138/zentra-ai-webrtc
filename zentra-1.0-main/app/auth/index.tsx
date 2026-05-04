import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { supabase } from '@/lib/supabase';
import { hasCompletedBodyMetrics } from '@/lib/bodyMetrics';

type TabType = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const ensureProfile = async (user: any) => {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, height_cm, weight_kg, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (profile) return profile;

    const { data: insertedProfile, error: insertError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          first_name: user.user_metadata?.first_name || firstName || 'Zentra',
          last_name: user.user_metadata?.last_name || lastName || 'User',
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      )
      .select('id, height_cm, weight_kg, onboarding_completed')
      .single();

    if (insertError) throw insertError;
    return insertedProfile;
  };

  const handleLogin = async () => {
    setError('');
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const profile = await ensureProfile(data.user);

        if (hasCompletedBodyMetrics(profile)) {
          router.replace('/(tabs)');
        } else {
          router.replace('/body-metrics');
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!firstName || !lastName) {
      setError('Please enter your first and last name');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        if (data.session) {
          await ensureProfile(data.user);
        }
        router.replace('/body-metrics');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetSent(false);
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.logo}>Zentra</Text>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'login' && styles.activeTab]}
                onPress={() => { setActiveTab('login'); setError(''); setResetSent(false); }}
              >
                <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>
                  Log In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'signup' && styles.activeTab]}
                onPress={() => { setActiveTab('signup'); setError(''); setResetSent(false); }}
              >
                <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={20} color={theme.colors.primaryDark} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {resetSent && (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>
                    Password reset email sent! Check your inbox.
                  </Text>
                </View>
              )}

              {activeTab === 'forgot' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Your Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="e.g. name@domain.com"
                      placeholderTextColor={theme.colors.inactive}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <PrimaryButton
                    title="Send Reset Link"
                    onPress={handleForgotPassword}
                    disabled={loading}
                    style={styles.submitButton}
                  />

                  <View style={styles.switchContainer}>
                    <Text style={styles.switchText}>Remembered your password? </Text>
                    <TouchableOpacity onPress={() => { setActiveTab('login'); setError(''); setResetSent(false); }}>
                      <Text style={styles.switchLink}>Sign in</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : activeTab === 'signup' && (
                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First name"
                      placeholderTextColor={theme.colors.inactive}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.halfInput]}>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last name"
                      placeholderTextColor={theme.colors.inactive}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Your Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. name@domain.com"
                  placeholderTextColor={theme.colors.inactive}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.colors.inactive}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={theme.colors.secondary} />
                    ) : (
                      <Eye size={20} color={theme.colors.secondary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {activeTab === 'signup' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Re-enter Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your password"
                      placeholderTextColor={theme.colors.inactive}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeIcon}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} color={theme.colors.secondary} />
                      ) : (
                        <Eye size={20} color={theme.colors.secondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeTab !== 'forgot' && (
                <>
                  <PrimaryButton
                    title={activeTab === 'login' ? 'Login' : 'Sign up'}
                    onPress={activeTab === 'login' ? handleLogin : handleSignup}
                    disabled={loading}
                    style={styles.submitButton}
                  />

                  {activeTab === 'login' && (
                    <TouchableOpacity
                      onPress={() => { setActiveTab('forgot'); setError(''); }}
                      style={styles.forgotPassword}
                    >
                      <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.switchContainer}>
                    <Text style={styles.switchText}>
                      {activeTab === 'login'
                        ? "Don't have an account? "
                        : 'Have an account? '}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                        setError('');
                        setResetSent(false);
                      }}
                    >
                      <Text style={styles.switchLink}>
                        {activeTab === 'login' ? 'Sign up' : 'Sign in'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inactive,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.colors.white,
  },
  form: {
    flex: 1,
  },

  /* 🔥 NEW STYLES FOR SIDE-BY-SIDE INPUTS */
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },

  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
  },
  eyeIcon: {
    padding: 16,
  },
  submitButton: {
    marginTop: 24,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  switchText: {
    color: theme.colors.secondary,
    fontSize: theme.fontSize.sm,
  },
  switchLink: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(177, 14, 14, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: theme.colors.primaryDark,
    fontSize: theme.fontSize.sm,
  },
  successContainer: {
    backgroundColor: 'rgba(0, 200, 100, 0.1)',
    borderWidth: 1,
    borderColor: '#00C864',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#00C864',
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
});
