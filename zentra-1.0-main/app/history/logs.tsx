import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import DayProgressBar from '@/components/DayProgressBar';
import { supabase } from '@/lib/supabase';

export default function LogsHistoryScreen() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadLogsHistory();
  }, []);

  const loadLogsHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from('user_logs_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistoryData(data || []);
    } catch (error) {
      console.error('Error loading logs history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_logs_history')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadLogsHistory();
            } catch (error) {
              console.error('Error deleting log:', error);
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
      const logsForDay = historyData.filter((log) => {
        const sets = Array.isArray(log.sets) ? log.sets : [];
        return sets.some((set: any) => new Date(set.timestamp).getDate() === i);
      });

      const totalSets = logsForDay.reduce((sum, log) => {
        const sets = Array.isArray(log.sets) ? log.sets : [];
        return sum + sets.filter((set: any) => new Date(set.timestamp).getDate() === i).length;
      }, 0);

      const completion = Math.min((totalSets / 10) * 100, 100);

      days.push({
        date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        completionPercent: completion,
        label: String(i),
      });
    }

    return days;
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
          <Text style={styles.headerTitle}>Logs History</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <DayProgressBar days={getDayData()} />

          <View style={styles.logsContainer}>
            <Text style={styles.sectionTitle}>Workout Logs</Text>

            {loading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : historyData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No workout logs yet</Text>
                <Text style={styles.emptySubtext}>Start logging your workouts to see them here</Text>
              </View>
            ) : (
              historyData.map((log) => {
                const sets = Array.isArray(log.sets) ? log.sets : [];
                const completedSets = sets.filter((set: any) => set.logged);
                const totalVolume = completedSets.reduce(
                  (sum: number, set: any) => sum + Number(set.weight || 0) * Number(set.reps || 0),
                  0
                );
                const latestSet = [...sets].sort((a: any, b: any) => {
                  const aTime = new Date(a.timestamp || a.date || 0).getTime();
                  const bTime = new Date(b.timestamp || b.date || 0).getTime();
                  return bTime - aTime;
                })[0];
                const latestDate = latestSet?.date || latestSet?.timestamp?.slice(0, 10);
                return (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <View style={styles.logInfo}>
                        <Text style={styles.exerciseName}>{log.exercise_name}</Text>
                        <Text style={styles.muscleGroup}>{log.muscle_group}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(log.id)}>
                        <Trash2 size={20} color={theme.colors.primaryDark} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.setsInfo}>
                      <Text style={styles.setsText}>
                        {completedSets.length}/{sets.length} completed sets
                      </Text>
                      <Text style={styles.detailText}>Volume: {totalVolume} kg</Text>
                      {latestDate && <Text style={styles.detailText}>Latest log: {latestDate}</Text>}
                    </View>
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
  logsContainer: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 16,
  },
  logCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 4,
  },
  muscleGroup: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    textTransform: 'capitalize',
  },
  setsInfo: {
    marginTop: 8,
  },
  setsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  detailText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginTop: 4,
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
