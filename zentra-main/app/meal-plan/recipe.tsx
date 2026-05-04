import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { generateDailyRecipes, type RecipeResponse } from '@/lib/mealGeneratorApi';
import { getGeneratedMealPlan, type DayMealPlan, type MealKey } from '@/lib/mealPlanStore';

const mealLabels: Record<MealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const mealKeys = Object.keys(mealLabels) as MealKey[];

export default function RecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const requestedDay = (params.day as string) || 'day1';
  const source = params.source as string | undefined;
  const { dailyPlan, weeklyPlan } = getGeneratedMealPlan();
  const selectedDayPlan: DayMealPlan | undefined =
    source === 'daily'
      ? dailyPlan ?? weeklyPlan?.day1
      : weeklyPlan?.[requestedDay] ?? dailyPlan;
  const [recipes, setRecipes] = useState<Partial<Record<MealKey, RecipeResponse>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecipes() {
      if (!selectedDayPlan) return;

      setLoading(true);
      try {
        const recipeData = await generateDailyRecipes(
          Object.fromEntries(
            mealKeys.map((mealKey) => [mealKey, selectedDayPlan[mealKey].food])
          )
        );

        if (!cancelled) {
          setRecipes(recipeData as Partial<Record<MealKey, RecipeResponse>>);
        }
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert('Recipe error', error.message || 'Failed to generate recipes.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecipes();

    return () => {
      cancelled = true;
    };
  }, [requestedDay, selectedDayPlan]);

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Recipes</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!selectedDayPlan ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No generated meal plan yet.</Text>
              <Text style={styles.emptySubtext}>Generate a daily or weekly plan first.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.dayTitle}>
                {requestedDay.replace('day', 'Day ')}
              </Text>
              {loading && <Text style={styles.loadingText}>Generating recipes for the full day...</Text>}

              {mealKeys.map((mealKey) => {
                const meal = selectedDayPlan[mealKey];
                const recipe = recipes[mealKey];
                const ingredients = recipe?.ingredients?.items ?? [];
                const steps = recipe?.instructions?.steps ?? [];

                return (
                  <View key={mealKey} style={styles.recipeCard}>
                    <Text style={styles.mealLabel}>{mealLabels[mealKey]}</Text>
                    <Text style={styles.recipeTitle}>{recipe?.meal_name ?? meal.food}</Text>
                    <Text style={styles.macroText}>{meal.portion}</Text>
                    <Text style={styles.macroText}>
                      {Math.round(meal.macros.energy_kcal)} kcal | P {Math.round(meal.macros.protein_g)}g | C {Math.round(meal.macros.carbohydrates_g)}g | F {Math.round(meal.macros.fat_g)}g
                    </Text>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Ingredients</Text>
                      {ingredients.length === 0 ? (
                        <Text style={styles.placeholderText}>{loading ? 'Asking the chef...' : 'No ingredients returned.'}</Text>
                      ) : ingredients.map((item, index) => (
                        <View key={index} style={styles.listItem}>
                          <Text style={styles.bullet}>{'\u2022'}</Text>
                          <Text style={styles.listText}>{item}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Steps</Text>
                      {steps.length === 0 ? (
                        <Text style={styles.placeholderText}>{loading ? 'Preparing steps...' : 'No steps returned.'}</Text>
                      ) : steps.map((step, index) => (
                        <View key={index} style={styles.listItem}>
                          <Text style={styles.stepNumber}>{index + 1}.</Text>
                          <Text style={styles.listText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}
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
  dayTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 8,
  },
  loadingText: {
    color: theme.colors.secondary,
    marginBottom: 16,
  },
  recipeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 18,
  },
  mealLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '700',
    marginBottom: 6,
  },
  recipeTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 10,
  },
  macroText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    marginBottom: 4,
  },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 8,
  },
  bullet: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    marginRight: 10,
    width: 18,
  },
  stepNumber: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
    marginRight: 10,
    width: 22,
  },
  listText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    lineHeight: 20,
  },
  placeholderText: {
    color: theme.colors.secondary,
    fontSize: theme.fontSize.sm,
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
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
