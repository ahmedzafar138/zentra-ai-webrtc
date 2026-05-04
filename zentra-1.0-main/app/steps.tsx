import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Accelerometer } from "expo-sensors";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Flame, MapPin, Clock } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import CircularProgress from "@/components/CircularProgress";

type StepData = {
  steps: number;
  goal: number;
  kcal: number;
  distance_km: number;
  active_minutes: number;
};

export default function StepsScreen() {
  const [stepData, setStepData] = useState<StepData>({
    steps: 0,
    goal: 8000,
    kcal: 0,
    distance_km: 0,
    active_minutes: 0,
  });

  const router = useRouter();
  const accelSubscription = useRef<{ remove: () => void } | null>(null);
  const lastPeak = useRef(0);

  useEffect(() => {
    loadStepData();
    startStepTracking();

    return () => {
      if (accelSubscription.current) accelSubscription.current.remove();
    };
  }, []);

  const loadStepData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("steps_goal")
        .eq("id", user.id)
        .maybeSingle();

      const goal = profile?.steps_goal || 8000;

      const today = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("step_tracking")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (data) {
        setStepData({
          steps: Number(data.steps || 0),
          goal,
          kcal: Number(data.kcal || 0),
          distance_km: Number(data.distance_km || 0),
          active_minutes: Number(data.active_minutes || 0),
        });
      } else {
        setStepData({
          steps: 0,
          goal,
          kcal: 0,
          distance_km: 0,
          active_minutes: 0,
        });
      }
    } catch (error) {
      console.log("Error loading step data:", error);
    }
  };

  const startStepTracking = () => {
    Accelerometer.setUpdateInterval(50);

    let filtered = 0;
    let peakDetected = false;

    const thresholdHigh = 1.35;
    const thresholdLow = 1.10;

    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      filtered = 0.6 * filtered + 0.4 * magnitude;

      const now = Date.now();

      if (!peakDetected && filtered > thresholdHigh) {
        peakDetected = true;
      }

      if (peakDetected && filtered < thresholdLow) {
        if (now - lastPeak.current > 400) {
          lastPeak.current = now;
          addStep();
        }
        peakDetected = false;
      }
    });
  };

  const addStep = async () => {
    setStepData(prev => {
      const updated = {
        ...prev,
        steps: prev.steps + 1,
        kcal: (prev.steps + 1) * 0.04,
        distance_km: Number(((prev.steps + 1) * 0.0008).toFixed(3)),
        active_minutes: Math.floor((prev.steps + 1) / 120),
      };
      saveSteps(updated);
      return updated;
    });
  };

  const saveSteps = async (data: StepData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];
      const month = today.slice(0, 7);
      const dailyEntry = {
        date: today,
        steps: data.steps,
        goal: data.goal,
        kcal: data.kcal,
        distance_km: data.distance_km,
        active_minutes: data.active_minutes,
      };

      const { error: dailyError } = await supabase.from("step_tracking").upsert(
        {
          user_id: user.id,
          date: today,
          steps: data.steps,
          goal: data.goal,
          kcal: data.kcal,
          distance_km: data.distance_km,
          active_minutes: data.active_minutes,
        },
        { onConflict: "user_id,date" }
      );

      if (dailyError) throw dailyError;

      const { data: monthHistory, error: monthError } = await supabase
        .from("user_steps_history")
        .select("daily_data")
        .eq("user_id", user.id)
        .eq("month", month)
        .maybeSingle();

      if (monthError) throw monthError;

      const existingDailyData = Array.isArray(monthHistory?.daily_data)
        ? monthHistory.daily_data
        : [];
      const dailyData = [
        ...existingDailyData.filter((entry: any) => entry.date !== today),
        dailyEntry,
      ].sort((a: any, b: any) => a.date.localeCompare(b.date));

      const { error: historyError } = await supabase.from("user_steps_history").upsert(
        {
          user_id: user.id,
          month,
          daily_data: dailyData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,month" }
      );

      if (historyError) throw historyError;
    } catch (error) {
      console.log("Saving error:", error);
    }
  };

  const progress = (stepData.steps / stepData.goal) * 100;
  const progressClamped = Math.min(progress, 100);

  return (
    <LinearGradient colors={[theme.colors.background, "#0A0A0A"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>Today</Text>
            <Text style={styles.dateSubtext}>
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <CircularProgress size={220} strokeWidth={16} progress={progressClamped}>
              <View style={styles.progressInner}>
                <Text style={styles.stepsNumber}>{stepData.steps}</Text>
                <Text style={styles.stepsLabel}>of {stepData.goal}</Text>
                <Text style={styles.progressPercent}>{Math.round(progressClamped)}%</Text>
              </View>
            </CircularProgress>
          </View>

          <View style={styles.centerContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Flame size={24} color={theme.colors.primary} />
                <Text style={styles.statValue}>{stepData.kcal.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Kcal</Text>
              </View>

              <View style={styles.statCard}>
                <MapPin size={24} color={theme.colors.primary} />
                <Text style={styles.statValue}>{stepData.distance_km}</Text>
                <Text style={styles.statLabel}>Kilometers</Text>
              </View>

              <View style={styles.statCard}>
                <Clock size={24} color={theme.colors.primary} />
                <Text style={styles.statValue}>{stepData.active_minutes}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push("/history/steps")}
            >
              <Text style={styles.historyButtonText}>Steps History</Text>
            </TouchableOpacity>
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
    paddingVertical: 24,
  },

  dateRow: {
    alignItems: "center",
    marginBottom: 32,
  },

  dateText: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
    color: theme.colors.white,
    marginBottom: 4,
  },

  dateSubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },

  progressContainer: {
    alignItems: "center",
    marginBottom: 32,
  },

  progressInner: {
    alignItems: "center",
  },

  stepsNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: theme.colors.white,
  },

  stepsLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    marginBottom: 8,
  },

  progressPercent: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
    color: theme.colors.primary,
  },

  centerContainer: {
    alignItems: "center",
  },

  statsGrid: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },

  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: "bold",
    color: theme.colors.white,
  },

  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
  },

  historyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: theme.borderRadius.lg,
    marginTop: 16,
  },

  historyButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: theme.colors.white,
    textAlign: "center",
  },
});
