import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function StepsHistoryScreen() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadStepsHistory();
    }, [])
  );

  const loadStepsHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthStart = `${currentMonth}-01`;
      const today = new Date().toISOString().split('T')[0];

      const { data: monthHistory, error: historyError } = await supabase
        .from('user_steps_history')
        .select('daily_data')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle();

      if (historyError) throw historyError;

      const { data: dailyRows, error: dailyError } = await supabase
        .from('step_tracking')
        .select('date, steps, goal, kcal, distance_km, active_minutes')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', today)
        .order('date', { ascending: true });

      if (dailyError) throw dailyError;

      const byDate = new Map<string, any>();
      const monthlyRows = Array.isArray(monthHistory?.daily_data) ? monthHistory.daily_data : [];

      monthlyRows.forEach((day: any) => {
        if (!day?.date) return;

        byDate.set(day.date, {
          ...day,
          steps: Number(day.steps || 0),
          goal: Number(day.goal || 8000),
          kcal: Number(day.kcal || 0),
          distance_km: Number(day.distance_km || 0),
          active_minutes: Number(day.active_minutes || 0),
        });
      });

      (dailyRows || []).forEach((day: any) => {
        byDate.set(day.date, {
          ...day,
          steps: Number(day.steps || 0),
          goal: Number(day.goal || 8000),
          kcal: Number(day.kcal || 0),
          distance_km: Number(day.distance_km || 0),
          active_minutes: Number(day.active_minutes || 0),
        });
      });

      setHistoryData(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error loading steps history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete History',
      'Are you sure you want to delete this month\'s step history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const currentMonth = new Date().toISOString().slice(0, 7);
              const monthStart = `${currentMonth}-01`;
              const today = new Date().toISOString().split('T')[0];

              const { error: historyError } = await supabase
                .from('user_steps_history')
                .delete()
                .eq('user_id', user.id)
                .eq('month', currentMonth);

              if (historyError) throw historyError;

              const { error: dailyError } = await supabase
                .from('step_tracking')
                .delete()
                .eq('user_id', user.id)
                .gte('date', monthStart)
                .lte('date', today);

              if (dailyError) throw dailyError;
              loadStepsHistory();
            } catch (error) {
              console.error('Error deleting steps history:', error);
            }
          },
        },
      ]
    );
  };

  const getDayData = () => {
    const daysInMonth = new Date().getDate();
    const days = [];

    for (let i = 1; i <= Math.min(daysInMonth, 30); i++) {
      const dayData = historyData.find((d: any) => {
        const date = new Date(d.date);
        return date.getDate() === i;
      });

      const steps = dayData?.steps || 0;
      const goal = dayData?.goal || 8000;
      const completion = Math.min((steps / goal) * 100, 100);

      days.push({
        date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        completionPercent: completion,
        label: String(i),
      });
    }

    return days;
  };

  const getTotalStats = () => {
    const totalSteps = historyData.reduce((sum: number, day: any) => sum + (day.steps || 0), 0);
    const totalDistance = historyData.reduce((sum: number, day: any) => sum + (day.distance_km || 0), 0);
    const totalKcal = historyData.reduce((sum: number, day: any) => sum + (day.kcal || 0), 0);

    return { totalSteps, totalDistance, totalKcal };
  };

  const stats = getTotalStats();

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
          <Text style={styles.headerTitle}>Steps History</Text>
          {historyData.length > 0 && (
            <TouchableOpacity onPress={handleDelete}>
              <Trash2 size={20} color={theme.colors.primaryDark} />
            </TouchableOpacity>
          )}
          {historyData.length === 0 && <View style={{ width: 24 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Daily Progress</Text>
            <View style={styles.dayCircleGrid}>
              {getDayData().map((day) => {
                const fillHeight = (Math.min(day.completionPercent, 100) / 100) * 34;

                return (
                  <TouchableOpacity key={day.date} style={styles.dayCircleButton} activeOpacity={0.8}>
                    <View style={styles.dayCircle}>
                      <View style={[styles.dayCircleFill, { height: fillHeight }]} />
                      <Text style={styles.dayCircleLabel}>{day.label}</Text>
                    </View>
                    <Text style={styles.dayCirclePercent}>
                      {Math.round(day.completionPercent)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Monthly Summary</Text>

            {loading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : historyData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No step history yet</Text>
                <Text style={styles.emptySubtext}>Start tracking your steps to see them here</Text>
              </View>
            ) : (
              <View style={styles.summaryCard}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalSteps.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Total Steps</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalDistance.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Kilometers</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(stats.totalKcal)}</Text>
                  <Text style={styles.statLabel}>Calories</Text>
                </View>
              </View>
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
    paddingBottom: 16,
  },
  statsContainer: {
    paddingHorizontal: 24,
  },
  dayCircleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 18,
  },
  dayCircleButton: {
    alignItems: 'center',
    width: '13%',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.inactive,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCircleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
  },
  dayCircleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.white,
  },
  dayCirclePercent: {
    fontSize: 9,
    color: theme.colors.secondary,
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 10,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    textAlign: 'center',
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
