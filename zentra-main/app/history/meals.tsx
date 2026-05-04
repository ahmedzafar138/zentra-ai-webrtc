import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { setGeneratedMealPlan } from '@/lib/mealPlanStore';

export default function MealsHistoryScreen() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadMealHistory();
    }, [])
  );

  const loadMealHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_meal_history')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      setHistoryData(data || []);
    } catch (error) {
      console.error('Error loading meal history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Meal Plan',
      'Are you sure you want to delete this meal plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_meal_history')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadMealHistory();
            } catch (error) {
              console.error('Error deleting meal plan:', error);
            }
          },
        },
      ]
    );
  };

  const parseMealData = (meal: any) => {
    try {
      return typeof meal.meal_plan_data === 'string'
        ? JSON.parse(meal.meal_plan_data)
        : meal.meal_plan_data;
    } catch {
      return {};
    }
  };

  const getMealSummary = (mealData: any) => {
    const plan = mealData?.plan || {};
    const dayCount = Object.keys(plan).length;
    const firstDay = plan.day1 || Object.values(plan)[0] || {};
    const firstMeals = Object.values(firstDay as any)
      .map((item: any) => item?.food)
      .filter(Boolean);

    return {
      dayCount,
      firstMeals,
      planType: mealData?.plan_type || (dayCount > 1 ? 'weekly' : 'daily'),
    };
  };

  const handleOpenMealPlan = (meal: any) => {
    const mealData = parseMealData(meal);
    const plan = mealData?.plan;

    if (!plan) {
      Alert.alert('Meal plan unavailable', 'This saved meal plan does not contain plan details.');
      return;
    }

    setGeneratedMealPlan({
      dailyPlan: plan.day1,
      weeklyPlan: plan,
      culinaryPreference: mealData.culinary_preference,
      dietaryPreference: mealData.dietary_preference,
      goal: mealData.goal,
      weekStartDate: meal.week_start_date,
    });

    if ((mealData.plan_type || '').toLowerCase() === 'daily') {
      router.push('/meal-plan/recipe?source=daily&day=day1');
    } else {
      router.push('/meal-plan/weekly');
    }
  };

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
          <Text style={styles.headerTitle}>Meal History</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.mealsContainer}>
            <Text style={styles.sectionTitle}>Saved Meal Plans</Text>

            {loading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : historyData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No saved meal plans yet</Text>
                <Text style={styles.emptySubtext}>Generate and save meal plans to see them here</Text>
              </View>
            ) : (
              historyData.map((meal) => {
                const mealData = parseMealData(meal);
                const summary = getMealSummary(mealData);
                const weekStart = new Date(meal.week_start_date);

                return (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeader}>
                      <View style={styles.mealInfo}>
                        <Text style={styles.weekLabel}>
                          {summary.planType === 'daily'
                            ? 'Saved Daily Plan'
                            : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </Text>
                        {mealData?.culinary_preference && (
                          <Text style={styles.preference}>{mealData.culinary_preference}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(meal.id)}>
                        <Trash2 size={20} color={theme.colors.primaryDark} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(meal.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    {summary.firstMeals.length > 0 && (
                      <Text style={styles.mealPreview} numberOfLines={2}>
                        {summary.firstMeals.join(' • ')}
                      </Text>
                    )}
                    <TouchableOpacity style={styles.viewButton} onPress={() => handleOpenMealPlan(meal)}>
                      <Text style={styles.viewButtonText}>
                        {summary.planType === 'daily' ? 'View Daily Recipes' : `View ${summary.dayCount}-Day Plan`}
                      </Text>
                      <ChevronRight size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
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
    paddingBottom: 24,
  },
  mealsContainer: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 16,
  },
  mealCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  mealInfo: {
    flex: 1,
  },
  weekLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 4,
  },
  preference: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
  mealPreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    marginTop: 10,
    lineHeight: 20,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 12,
  },
  viewButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.inactive,
    textAlign: 'center',
  },
});
