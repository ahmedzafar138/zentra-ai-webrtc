import React from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { getGeneratedMealPlan } from '@/lib/mealPlanStore';
import { supabase } from '@/lib/supabase';

const mealTypes = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
  snacks: 'S',
};

export default function WeeklyMealPlanScreen() {
  const router = useRouter();
  const {
    weeklyPlan,
    culinaryPreference,
    dietaryPreference,
    goal,
    weekStartDate,
  } = getGeneratedMealPlan();
  const weekEntries = weeklyPlan
    ? Array.from({ length: 7 }, (_, index) => {
        const dayKey = `day${index + 1}`;
        return [dayKey, weeklyPlan[dayKey]] as const;
      }).filter(([, mealsForDay]) => Boolean(mealsForDay))
    : [];

  const getDayTotals = (mealsForDay: NonNullable<typeof weeklyPlan>[string]) => {
    return Object.values(mealsForDay).reduce(
      (totals, meal) => ({
        calories: totals.calories + Number(meal?.macros?.energy_kcal || 0),
        protein: totals.protein + Number(meal?.macros?.protein_g || 0),
        carbs: totals.carbs + Number(meal?.macros?.carbohydrates_g || 0),
        fat: totals.fat + Number(meal?.macros?.fat_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const getWeekStartDate = () => {
    if (weekStartDate) return weekStartDate;

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date.toISOString().split('T')[0];
  };

  const handleSaveWeeklyPlan = async () => {
    if (!weeklyPlan) {
      Alert.alert('No weekly plan yet', 'Generate a weekly plan before saving.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before saving a meal plan.');

      const { error } = await supabase
        .from('user_meal_history')
        .upsert(
          {
            user_id: user.id,
            week_start_date: getWeekStartDate(),
            meal_plan_data: {
              plan_type: 'weekly',
              culinary_preference: culinaryPreference,
              dietary_preference: dietaryPreference,
              goal,
              plan: weeklyPlan,
              saved_at: new Date().toISOString(),
            },
          },
          { onConflict: 'user_id,week_start_date' }
        );

      if (error) throw error;
      Alert.alert('Meal plan saved', 'You can find it in Meal History.');
    } catch (error: any) {
      Alert.alert('Save failed', error.message || 'Could not save this meal plan.');
    }
  };

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weekly Meal Plan</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtitle}>This is what you need for the entire week.</Text>

          {weekEntries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No generated meal plan yet.</Text>
              <Text style={styles.emptySubtext}>Go back and generate a weekly plan first.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekCarousel}
                snapToInterval={326}
                decelerationRate="fast"
              >
                {weekEntries.map(([dayKey, mealsForDay], index) => {
                  const totals = getDayTotals(mealsForDay);

                  return (
                    <View key={dayKey} style={styles.dayCard}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayTitle}>Day {index + 1}</Text>
                        <Text style={styles.caloriePill}>{Math.round(totals.calories)} cal</Text>
                      </View>

                      <View style={styles.macroRow}>
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{Math.round(totals.protein)}g</Text>
                          <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{Math.round(totals.carbs)}g</Text>
                          <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{Math.round(totals.fat)}g</Text>
                          <Text style={styles.macroLabel}>Fat</Text>
                        </View>
                      </View>

                      <View style={styles.mealsRow}>
                        {Object.entries(mealTypes).map(([mealKey, label], idx) => {
                          const meal = mealsForDay[mealKey as keyof typeof mealsForDay];
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={styles.mealChip}
                              disabled={!meal?.food}
                              onPress={() =>
                                router.push(`/meal-plan/recipe?meal=${mealKey}&day=${dayKey}`)
                              }
                            >
                              <Text style={styles.mealType}>{label}</Text>
                              <View style={styles.mealDetails}>
                                <Text style={styles.mealName} numberOfLines={1}>
                                  {meal?.food ?? 'Not generated'}
                                </Text>
                                {meal?.macros && (
                                  <Text style={styles.mealMacros} numberOfLines={1}>
                                    {Math.round(meal.macros.energy_kcal)} cal | C {Math.round(meal.macros.carbohydrates_g)}g
                                  </Text>
                                )}
                              </View>
                              <ChevronRight size={16} color={theme.colors.secondary} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveWeeklyPlan}>
                <Save size={18} color={theme.colors.white} />
                <Text style={styles.saveButtonText}>Save Weekly Meal Plan</Text>
              </TouchableOpacity>
            </>
          )}

          <PrimaryButton
            title="Create Shopping List"
            onPress={() => router.push('/meal-plan/shopping-list')}
            style={styles.button}
            disabled={weekEntries.length === 0}
          />
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
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    marginBottom: 20,
  },
  weekCarousel: {
    gap: 14,
    paddingRight: 24,
    marginBottom: 16,
  },
  dayCard: {
    width: 312,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
  },
  caloriePill: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  macroItem: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.white,
  },
  macroLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  mealsRow: { gap: 8 },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: 12, gap: 8,
  },
  mealType: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    width: 20,
  },
  mealName: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
  },
  mealDetails: {
    flex: 1,
  },
  mealMacros: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginBottom: 8,
  },
  saveButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    fontWeight: '700',
  },
  button: { marginTop: 16 },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
});
