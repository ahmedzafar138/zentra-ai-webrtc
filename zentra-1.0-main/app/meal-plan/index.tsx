import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronDown, Save } from "lucide-react-native";
import { theme } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";
import { generateDailyMealPlan, generateWeeklyMealPlan } from "@/lib/mealGeneratorApi";
import { getGeneratedMealPlan, setGeneratedMealPlan, type DayMealPlan, type WeeklyMealPlan } from "@/lib/mealPlanStore";
import { supabase } from "@/lib/supabase";

type DropdownProps = {
  label: string;
  value: string;
  setValue: (val: string) => void;
  options: string[];
};

function Dropdown({ label, value, setValue, options }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.controlLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownText}>{value}</Text>
        <ChevronDown size={20} color={theme.colors.secondary} />
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdownList}>
          {options.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dropdownItem}
              onPress={() => {
                setValue(item);
                setOpen(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MealGeneratorScreen() {
  const router = useRouter();

  const [culinaryPreference, setCulinaryPreference] = useState("Any");
  const [dietaryPreference, setDietaryPreference] = useState("None");
  const [goal, setGoal] = useState("");
  const [dailyLoading, setDailyLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [dailyPlan, setDailyPlan] = useState<DayMealPlan | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);

  const getWeekStartDate = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date.toISOString().split("T")[0];
  };

  const buildUserProfilePrompt = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Please sign in before generating a meal plan.");
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("height_cm, weight_kg, height_unit, weight_unit")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const stats = profile
      ? `Height: ${profile.height_cm ?? "not set"} cm. Weight: ${profile.weight_kg ?? "not set"} kg.`
      : "Height and weight are not set.";

    return [
      stats,
      `Culinary preference: ${culinaryPreference}.`,
      `Dietary preference: ${dietaryPreference}.`,
      `Goal: ${goal.trim() || "balanced fitness nutrition"}.`,
    ].join(" ");
  };

  const isCompleteDayPlan = (plan?: DayMealPlan | null) => {
    return Boolean(
      plan?.breakfast?.food &&
      plan?.lunch?.food &&
      plan?.dinner?.food &&
      plan?.snacks?.food
    );
  };

  const isCompleteWeeklyPlan = (plan?: WeeklyMealPlan | null) => {
    if (!plan) return false;

    return Array.from({ length: 7 }, (_, index) => `day${index + 1}`).every(
      (dayKey) => isCompleteDayPlan(plan[dayKey])
    );
  };

  const handleGenerateDaily = async () => {
    setDailyLoading(true);
    try {
      const userProfile = await buildUserProfilePrompt();
      const plan = await generateDailyMealPlan({
        userProfile,
        dietaryPreference,
        additionalRequirements: goal,
      });

      if (!isCompleteDayPlan(plan)) {
        throw new Error("Daily meal plan was generated in an unexpected format.");
      }

      setDailyPlan(plan);
      setGeneratedMealPlan({
        dailyPlan: plan,
        weeklyPlan: { day1: plan },
        culinaryPreference,
        dietaryPreference,
        goal,
      });
    } catch (error: any) {
      Alert.alert("Meal generator error", error.message || "Failed to generate daily meal plan.");
    } finally {
      setDailyLoading(false);
    }
  };

  const handleGenerateWeekly = async () => {
    setWeeklyLoading(true);
    try {
      const userProfile = await buildUserProfilePrompt();
      const plan = await generateWeeklyMealPlan({
        userProfile,
        dietaryPreference,
        additionalRequirements: goal,
      });

      if (!isCompleteWeeklyPlan(plan)) {
        throw new Error("Weekly meal plan was generated in an unexpected format.");
      }

      const weekStartDate = getWeekStartDate();

      setWeeklyPlan(plan);
      setDailyPlan(plan.day1);
      setGeneratedMealPlan({
        dailyPlan: plan.day1,
        weeklyPlan: plan,
        culinaryPreference,
        dietaryPreference,
        goal,
        weekStartDate,
      });

      router.push("/meal-plan/weekly");
    } catch (error: any) {
      Alert.alert("Meal generator error", error.message || "Failed to generate weekly meal plan.");
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleSaveMealPlan = async () => {
    const planToSave = weeklyPlan ?? (dailyPlan ? { day1: dailyPlan } : null);

    if (!planToSave) {
      Alert.alert("No meal plan yet", "Generate a daily or weekly meal plan before saving.");
      return;
    }

    setSavingPlan(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in before saving a meal plan.");

      const planType = weeklyPlan ? "weekly" : "daily";
      const savedDate = planType === "weekly" ? getWeekStartDate() : new Date().toISOString().split("T")[0];

      const { error } = await supabase
        .from("user_meal_history")
        .upsert(
          {
            user_id: user.id,
            week_start_date: savedDate,
            meal_plan_data: {
              plan_type: planType,
              culinary_preference: culinaryPreference,
              dietary_preference: dietaryPreference,
              goal,
              plan: planToSave,
              saved_at: new Date().toISOString(),
            },
          },
          { onConflict: "user_id,week_start_date" }
        );

      if (error) throw error;

      Alert.alert("Meal plan saved", "You can find it in Meal History.");
    } catch (error: any) {
      Alert.alert("Save failed", error.message || "Could not save this meal plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleGetRecipe = () => {
    const generatedState = getGeneratedMealPlan();
    const storedDailyPlan = generatedState.dailyPlan ?? generatedState.weeklyPlan?.day1;

    if (!isCompleteDayPlan(dailyPlan ?? weeklyPlan?.day1 ?? storedDailyPlan)) {
      Alert.alert("Generate a plan first", "Generate a daily or weekly meal plan before viewing recipes.");
      return;
    }

    router.push("/meal-plan/recipe?source=daily&day=day1");
  };

  const previewPlan = dailyPlan ?? weeklyPlan?.day1;
  const mealTypes = previewPlan
    ? [
        { label: "Breakfast", meal: previewPlan.breakfast },
        { label: "Lunch", meal: previewPlan.lunch },
        { label: "Dinner", meal: previewPlan.dinner },
        { label: "Snacks", meal: previewPlan.snacks },
      ].map(({ label, meal }) => ({
        label,
        name: meal.food,
        calories: Math.round(meal.macros.energy_kcal),
        protein: Math.round(meal.macros.protein_g),
        carbs: Math.round(meal.macros.carbohydrates_g),
        fat: Math.round(meal.macros.fat_g),
      }))
    : [
    { label: "Breakfast", name: "Not generated yet", calories: 0, protein: 0, carbs: 0, fat: 0 },
    { label: "Lunch", name: "Not generated yet", calories: 0, protein: 0, carbs: 0, fat: 0 },
    { label: "Dinner", name: "Not generated yet", calories: 0, protein: 0, carbs: 0, fat: 0 },
    { label: "Snacks", name: "Not generated yet", calories: 0, protein: 0, carbs: 0, fat: 0 },
  ];

  const totalCalories = mealTypes.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = mealTypes.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = mealTypes.reduce((sum, m) => sum + m.carbs, 0);
  const totalFat = mealTypes.reduce((sum, m) => sum + m.fat, 0);

  return (
    <LinearGradient
      colors={[theme.colors.background, "#0A0A0A"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal Generator</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtitle}>Meal plan catered to your calorie intake.</Text>

          <View style={styles.controlsRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Dropdown
                label="Culinary Preference"
                value={culinaryPreference}
                setValue={setCulinaryPreference}
                options={["Any","Pakistani", "Italian", "Mexican", "Chinese", "American", "Mediterranean", "Thai"]}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Dropdown
                label="Dietary Preference"
                value={dietaryPreference}
                setValue={setDietaryPreference}
                options={["None","Vegetarian", "Keto", "Paleo", "High Protein", "Nut Free", "Dairy Free", "Gluten Free"]}
              />
            </View>
          </View>

          <View style={styles.goalContainer}>
            <Text style={styles.controlLabel}>Your Goal</Text>
            <TextInput
              style={styles.goalInput}
              value={goal}
              onChangeText={setGoal}
              placeholder="I want to lose weight and build muscle"
              placeholderTextColor={theme.colors.inactive}
              multiline
            />
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewGrid}>
              {mealTypes.map((meal, i) => (
                <View key={i} style={styles.previewCard}>
                  <Text style={styles.previewLabel}>{meal.label}</Text>
                  <Text style={styles.previewName} numberOfLines={2}>{meal.name}</Text>
                  <Text style={styles.previewCalories}>{meal.calories} cal</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsTitle}>Daily Totals</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalCalories}</Text>
                <Text style={styles.totalLabel}>Calories</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalProtein}g</Text>
                <Text style={styles.totalLabel}>Protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalCarbs}g</Text>
                <Text style={styles.totalLabel}>Carbs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalFat}g</Text>
                <Text style={styles.totalLabel}>Fat</Text>
              </View>
            </View>
          </View>

          <PrimaryButton
            title={dailyLoading ? "Generating Daily Plan..." : "Generate Daily Plan"}
            onPress={handleGenerateDaily}
            disabled={dailyLoading || weeklyLoading}
            style={styles.generateButton}
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGetRecipe}>
            <Text style={styles.secondaryButtonText}>View Daily Recipes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, !previewPlan && styles.saveButtonDisabled]}
            onPress={handleSaveMealPlan}
            disabled={!previewPlan || savingPlan}
          >
            <Save size={18} color={theme.colors.white} />
            <Text style={styles.saveButtonText}>
              {savingPlan ? "Saving Meal Plan..." : "Save Current Meal Plan"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGenerateWeekly}
            disabled={dailyLoading || weeklyLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {weeklyLoading ? "Generating 7-Day Plan..." : "Generate 7-Day Weekly Plan"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
    color: theme.colors.white,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    marginBottom: 24,
  },

  controlLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    marginBottom: 8,
    fontWeight: "500",
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 12,
  },
  dropdownText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
  },
  dropdownList: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  dropdownItemText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
  },

  controlsRow: { flexDirection: "row", marginBottom: -10 },

  goalContainer: { marginBottom: 24 },
  goalInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    minHeight: 80,
    textAlignVertical: "top",
  },

  previewSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: theme.colors.white,
    marginBottom: 12,
  },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  previewCard: {
    width: "48%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
  },
  previewLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    fontWeight: "500",
    marginBottom: 4,
  },
  previewCalories: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  previewName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginBottom: 6,
    minHeight: 30,
  },

  totalsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 24,
  },
  totalsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: theme.colors.white,
    marginBottom: 16,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalItem: { alignItems: "center" },
  totalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
  },

  generateButton: { marginBottom: 12 },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: "600",
  },
  secondaryButton: { padding: 16, alignItems: "center" },
  secondaryButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
