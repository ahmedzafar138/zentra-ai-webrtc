import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, TrendingUp, Award, CheckSquare, ChevronDown } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type TabType = 'summary' | 'byExercise' | 'calendar';

type HistorySet = {
  id: string;
  weight: number;
  reps: number;
  logged: boolean;
  date?: string;
  timestamp?: string;
};

type HistoryLog = {
  id: string;
  exercise_name: string;
  muscle_group: string;
  sets: HistorySet[];
};

type FlattenedSet = HistorySet & {
  exerciseName: string;
  muscleGroup: string;
  dateKey: string;
};

export default function WorkoutHistoryScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyData, setHistoryData] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistoryData([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_logs_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const logs = (data || []).map((log: any) => ({
        id: log.id,
        exercise_name: log.exercise_name,
        muscle_group: log.muscle_group,
        sets: Array.isArray(log.sets) ? log.sets : [],
      }));

      setHistoryData(logs);
      if (!selectedExercise && logs[0]?.exercise_name) {
        setSelectedExercise(logs[0].exercise_name);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load workout history');
    } finally {
      setLoading(false);
    }
  };

  const allLoggedSets = useMemo<FlattenedSet[]>(() => {
    return historyData.flatMap((log) =>
      log.sets
        .filter((set) => set.logged)
        .map((set) => ({
          ...set,
          exerciseName: log.exercise_name,
          muscleGroup: log.muscle_group,
          dateKey: set.date ?? set.timestamp?.slice(0, 10) ?? currentMonth,
        }))
    );
  }, [historyData, currentMonth]);

  const exerciseNames = Array.from(new Set(historyData.map((log) => log.exercise_name)));
  const totalVolume = allLoggedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const maxWeight = allLoggedSets.reduce((max, set) => Math.max(max, set.weight), 0);
  const totalSets = allLoggedSets.length;

  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = date.toISOString().split('T')[0];
    const volume = allLoggedSets
      .filter((set) => set.dateKey === dateKey)
      .reduce((sum, set) => sum + set.weight * set.reps, 0);

    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      volume,
    };
  });

  const maxVolume = Math.max(...chartData.map((d) => d.volume), 1);

  const exerciseHistory = allLoggedSets
    .filter((set) => !selectedExercise || set.exerciseName === selectedExercise)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dateKey = `${currentMonth}-${String(i + 1).padStart(2, '0')}`;
    const daySets = allLoggedSets.filter((set) => set.dateKey === dateKey);
    const volume = daySets.reduce((sum, set) => sum + set.weight * set.reps, 0);

    return {
      day: i + 1,
      dateKey,
      sets: daySets.length,
      volume,
    };
  });

  const selectedDaySets = allLoggedSets.filter((set) => set.dateKey === selectedCalendarDate);

  const getIntensityColor = (volume: number) => {
    if (volume === 0) return 'rgba(255,255,255,0.05)';
    const ratio = volume / Math.max(...calendarDays.map((day) => day.volume), 1);
    if (ratio < 0.25) return 'rgba(255, 106, 0, 0.2)';
    if (ratio < 0.5) return 'rgba(255, 106, 0, 0.4)';
    if (ratio < 0.75) return 'rgba(255, 106, 0, 0.6)';
    return theme.colors.primary;
  };

  const cycleExercise = () => {
    if (exerciseNames.length === 0) return;
    const currentIndex = exerciseNames.indexOf(selectedExercise);
    const nextIndex = currentIndex === -1 || currentIndex === exerciseNames.length - 1 ? 0 : currentIndex + 1;
    setSelectedExercise(exerciseNames[nextIndex]);
  };

  const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{subtitle}</Text>
    </View>
  );

  const renderSummaryTab = () => (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsContainer}
      >
        {[
          { icon: TrendingUp, label: 'Total Volume', value: totalVolume.toLocaleString(), unit: 'kg', subtext: 'This month' },
          { icon: Award, label: 'Max Weight', value: String(maxWeight), unit: 'kg', subtext: 'Highest logged set' },
          { icon: CheckSquare, label: 'Total Sets', value: String(totalSets), unit: '', subtext: 'Completed sets' },
        ].map((metric, index) => (
          <View key={index} style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <metric.icon size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricValue}>
                {metric.value}
                {metric.unit && <Text style={styles.metricUnit}> {metric.unit}</Text>}
              </Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricSubtext}>{metric.subtext}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Training Volume Over Time</Text>
        {totalSets === 0 ? (
          <EmptyState title="No summary yet" subtitle="Complete logged sets to build your workout summary." />
        ) : (
          <View style={styles.chart}>
            <View style={styles.chartBars}>
              {chartData.map((data, index) => (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.max((data.volume / maxVolume) * 100, data.volume ? 8 : 0)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{data.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderByExerciseTab = () => (
    <View>
      <View style={styles.exerciseSelector}>
        <TouchableOpacity style={styles.exerciseDropdown} onPress={cycleExercise}>
          <Text style={styles.exerciseDropdownText}>{selectedExercise || 'No exercises logged'}</Text>
          <ChevronDown size={20} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tableContainer}>
        {exerciseHistory.length === 0 ? (
          <EmptyState title="No logs for this exercise" subtitle="Log completed sets for an exercise to see its history here." />
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>DATE</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>WEIGHT</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>REPS</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>VOLUME</Text>
            </View>

            {exerciseHistory.map((record, index) => (
              <View key={`${record.exerciseName}-${record.id}-${index}`} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{record.dateKey}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{record.weight} kg</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{record.reps}</Text>
                <Text style={[styles.tableCell, { flex: 1.5, color: theme.colors.primary }]}>
                  {record.weight * record.reps} kg
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );

  const renderCalendarTab = () => (
    <View style={styles.calendarContainer}>
      <Text style={styles.sectionTitle}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
      <View style={styles.calendarGrid}>
        {calendarDays.map((day) => (
          <TouchableOpacity
            key={day.day}
            style={[
              styles.calendarDay,
              { backgroundColor: getIntensityColor(day.volume) },
              selectedCalendarDate === day.dateKey && styles.calendarDaySelected,
            ]}
            onPress={() => setSelectedCalendarDate(day.dateKey)}
          >
            <Text style={styles.calendarDayText}>{day.day}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.calendarLegend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendDots}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 106, 0, 0.2)' }]} />
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 106, 0, 0.4)' }]} />
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 106, 0, 0.6)' }]} />
          <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={styles.legendText}>More</Text>
      </View>

      <View style={styles.selectedDaySection}>
        <Text style={styles.sectionTitle}>Logs for {selectedCalendarDate}</Text>
        {selectedDaySets.length === 0 ? (
          <EmptyState title="No logs on this day" subtitle="Choose another date or add a workout log for this day." />
        ) : selectedDaySets.map((set, index) => (
          <View key={`${set.exerciseName}-${set.id}-${index}`} style={styles.dayLogCard}>
            <Text style={styles.dayLogTitle}>{set.exerciseName}</Text>
            <Text style={styles.dayLogText}>{set.weight} kg x {set.reps} reps</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Workout History</Text>
            <Text style={styles.headerSubtitle}>Review your performance and track progress</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.tabContainer}>
          {[
            ['summary', 'Summary'],
            ['byExercise', 'By Exercise'],
            ['calendar', 'Calendar'],
          ].map(([tab, label]) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as TabType)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <EmptyState title="Loading workout history..." subtitle="Your logs are being fetched." />
          ) : (
            <>
              {activeTab === 'summary' && renderSummaryTab()}
              {activeTab === 'byExercise' && renderByExerciseTab()}
              {activeTab === 'calendar' && renderCalendarTab()}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Back to Log" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  headerContent: { flex: 1 },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  tabTextActive: { color: theme.colors.white },
  scrollContent: { paddingBottom: 100 },
  metricsContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 24,
  },
  metricCard: {
    width: width * 0.7,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.3)',
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricContent: { gap: 4 },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  metricUnit: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
  },
  metricLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600',
  },
  metricSubtext: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
  },
  chartSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 16,
  },
  chart: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    height: 200,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBarWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
  },
  exerciseSelector: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  exerciseDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
  },
  exerciseDropdownText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '500',
  },
  tableContainer: { paddingHorizontal: 24 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.secondary,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: 4,
  },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.03)' },
  tableCell: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
  },
  calendarContainer: { paddingHorizontal: 24 },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  calendarDay: {
    width: (width - 48 - 6 * 8) / 7,
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  calendarDaySelected: {
    borderColor: theme.colors.white,
    borderWidth: 2,
  },
  calendarDayText: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: '500',
  },
  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  legendText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
  },
  legendDots: { flexDirection: 'row', gap: 6 },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  selectedDaySection: { marginTop: 8 },
  dayLogCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 8,
  },
  dayLogTitle: {
    color: theme.colors.white,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayLogText: {
    color: theme.colors.secondary,
    fontSize: theme.fontSize.sm,
  },
  emptyState: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 24,
  },
  emptyTitle: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: theme.colors.secondary,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: theme.colors.background,
  },
});
