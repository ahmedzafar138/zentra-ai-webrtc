import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Dumbbell,
  Activity,
  Shirt,
  BicepsFlexed,
  Footprints
} from 'lucide-react-native';
import { theme } from '@/constants/theme';

const muscleGroups = [
  { name: 'Chest', exercises: 8 },
  { name: 'Back', exercises: 10 },
  { name: 'Shoulders', exercises: 7 },
  { name: 'Legs', exercises: 12 },
  { name: 'Triceps', exercises: 6 },
  { name: 'Biceps', exercises: 6 },
];

const muscleIcons: Record<string, typeof Dumbbell> = {
  Chest: Shirt,
  Back: Activity,
  Shoulders: Dumbbell,
  Legs: Footprints,
  Triceps: Dumbbell,
  Biceps: BicepsFlexed,
};

export default function MuscleGroupPickerScreen() {
  const router = useRouter();

  // Animation for all icons
  const bounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1.15,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Animated.View style={{ transform: [{ scale: bounce }] }}>
              <ChevronLeft size={26} color={theme.colors.white} />
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>U</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.greeting}>Welcome Back!</Text>
          <Text style={styles.question}>What are you training today?</Text>

          <View style={styles.cardList}>
            {muscleGroups.map((group, index) => {
              const IconComponent = muscleIcons[group.name] || Dumbbell;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: '/form-correction/exercises',
                      params: { group: group.name },
                    })
                  }
                  activeOpacity={0.9}
                >
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{group.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      {group.exercises} exercises
                    </Text>
                  </View>

                  {/* Animated Icon */}
                  <Animated.View style={{ transform: [{ scale: bounce }] }}>
                    <IconComponent
                      size={34}
                      color={theme.colors.secondary}
                    />
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 8,
  },
  question: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.secondary,
    marginBottom: 32,
  },
  cardList: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadow.default,
  }, 
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
});
