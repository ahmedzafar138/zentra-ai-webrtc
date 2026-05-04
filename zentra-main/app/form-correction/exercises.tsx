import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '@/constants/theme';

const exercisesByGroup: { [key: string]: string[] } = {
  Chest: ['Bench Press', 'Push-ups', 'Dumbbell Flyes', 'Cable Crossover', 'Incline Press'],
  Back: ['Pull-ups', 'Bent Over Rows', 'Lat Pulldown', 'Deadlift', 'Cable Rows'],
  Shoulders: ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Arnold Press', 'Shrugs'],
  Legs: ['Squats', 'Lunges', 'Leg Press', 'Leg Curls', 'Calf Raises'],
  Triceps: ['Tricep Dips', 'Skull Crushers', 'Overhead Extension', 'Cable Pushdown'],
  Biceps: ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Concentration Curl'],
}; 


export default function ExerciseListScreen() {
  const params = useLocalSearchParams();
  const group = params.group as string;
  const exercises = exercisesByGroup[group] || [];
  const router = useRouter();

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{group}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{group} day, best day. Right?</Text>

          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <TouchableOpacity
                key={index}
                style={styles.exerciseCard}
                onPress={() =>
                  router.push({
                    pathname: '/form-correction/live',
                    params: { exercise, group },
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.exerciseName}>{exercise}</Text>
                <ChevronRight size={20} color={theme.colors.secondary} />
              </TouchableOpacity>
            ))}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 24,
  },
  exerciseList: {
    gap: 12,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 20,
  },
  exerciseName: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
    color: theme.colors.white,
    flex: 1,
  },
});
