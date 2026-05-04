import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle,
  ChefHat,
  MessageCircle,
  BarChart3,
  Footprints,
  Newspaper,
} from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function DashboardScreen() {
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [])
  );

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setUserName(profile.first_name);
          setAvatarUrl(profile.avatar_url ?? null);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const quickActions = [
    {
      icon: CheckCircle,
      title: 'Form Correction',
      onPress: () => router.push('/form-correction'),
    },
    {
      icon: ChefHat,
      title: 'Meal Plan',
      onPress: () => router.push('/meal-plan'),
    },
    {
      icon: MessageCircle,
      title: 'Zentra AI',
      onPress: () => router.push('/zentra-ai'),
    },
    {
      icon: BarChart3,
      title: 'Workout Log',
      onPress: () => router.push('/workout'),
    },
  ];

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
  <View>
    <Text style={styles.greeting}>Welcome Back!</Text>
    {userName && <Text style={styles.userName}>{userName}</Text>}
    <Text style={styles.date}>
      {new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}
    </Text>
  </View>

  <TouchableOpacity
    style={styles.avatar}
    activeOpacity={0.8}
    onPress={() => router.push('/profile')}
  >
    {avatarUrl ? (
      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
    ) : (
      <Text style={styles.avatarText}>
        {userName ? userName.charAt(0).toUpperCase() : 'U'}
      </Text>
    )}
  </TouchableOpacity>
</View>


          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.grid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.card}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                >
                  <action.icon size={32} color={theme.colors.primary} strokeWidth={1.5} />
                  <Text style={styles.cardTitle}>{action.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.utilityCard}
              onPress={() => router.push('/steps')}
              activeOpacity={0.8}
            >
              <Footprints size={28} color={theme.colors.primary} />
              <View style={styles.utilityContent}>
                <Text style={styles.utilityTitle}>Step Counter</Text>
                <Text style={styles.utilitySubtitle}>Track your daily steps</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.utilityCard}
              onPress={() => router.push('/blogs')}
              activeOpacity={0.8}
            >
              <Newspaper size={28} color={theme.colors.primary} />
              <View style={styles.utilityContent}>
                <Text style={styles.utilityTitle}>Blogs</Text>
                <Text style={styles.utilitySubtitle}>Stay updated with trends</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  greeting: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  userName: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  date: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: '47%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    minHeight: 140,
    justifyContent: 'center',
    ...theme.shadow.default,
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    textAlign: 'center',
  },
  utilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    gap: 16,
    ...theme.shadow.default,
  },
  utilityContent: {
    flex: 1,
  },
  utilityTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 4,
  },
  utilitySubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
});
