import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { supabase } from '@/lib/supabase';

type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  logged: boolean;
  timestamp?: string;
  date?: string;
};

type Exercise = {
  name: string;
  equipment?: string;
  sets: WorkoutSet[];
};

export const unstable_settings = {
  animation: {
    enabled: true,
    backgroundColor: '#000',
  },
};

export default function WorkoutLogScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState<string>('');

  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: '',
    weight: '',
    reps: '',
    equipment: 'Dumbbell',
    setsCount: '1',
  });

  const [showAddSetModal, setShowAddSetModal] = useState(false);
  const [currentExerciseForSet, setCurrentExerciseForSet] =
    useState<Exercise | null>(null);
  const [newSetData, setNewSetData] = useState({ weight: '', reps: '' });

  const router = useRouter();

  const toDateKey = (date: Date) => date.toISOString().split('T')[0];
  const toMonthKey = (date: Date) => date.toISOString().slice(0, 7);

  useEffect(() => {
    loadWorkoutLogs();
  }, [selectedDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const changeDate = (days: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(nextDate);
  };

  const loadWorkoutLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setExercises([]);
        return;
      }

      const selectedDateKey = toDateKey(selectedDate);
      const { data, error } = await supabase
        .from('user_logs_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', toMonthKey(selectedDate))
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const loadedExercises = (data || [])
        .map((log: any) => {
          const allSets = Array.isArray(log.sets) ? log.sets : [];
          const setsForDate = allSets.filter((set: WorkoutSet) => {
            const setDate = set.date ?? set.timestamp?.slice(0, 10);
            return setDate === selectedDateKey;
          });

          return {
            name: log.exercise_name,
            equipment: setsForDate[0]?.equipment ?? log.muscle_group,
            sets: setsForDate,
          };
        })
        .filter((exercise: Exercise) => exercise.sets.length > 0);

      setExercises(loadedExercises);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load workout logs');
    } finally {
      setLoading(false);
    }
  };

  const persistExercise = async (exercise: Exercise) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          first_name: user.user_metadata?.first_name || 'Zentra',
          last_name: user.user_metadata?.last_name || 'User',
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      );

    if (profileError) throw profileError;

    const month = toMonthKey(selectedDate);
    const selectedDateKey = toDateKey(selectedDate);

    const { data: existing, error: fetchError } = await supabase
      .from('user_logs_history')
      .select('sets')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('exercise_name', exercise.name)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const existingSets = Array.isArray(existing?.sets) ? existing.sets : [];
    const otherDaySets = existingSets.filter((set: WorkoutSet) => {
      const setDate = set.date ?? set.timestamp?.slice(0, 10);
      return setDate !== selectedDateKey;
    });

    const setsForSelectedDate = exercise.sets.map((set) => ({
      ...set,
      date: selectedDateKey,
      timestamp: set.timestamp ?? new Date().toISOString(),
      equipment: exercise.equipment,
    }));

    const { error } = await supabase
      .from('user_logs_history')
      .upsert(
        {
          user_id: user.id,
          month,
          exercise_name: exercise.name,
          muscle_group: exercise.equipment || 'Workout',
          sets: [...otherDaySets, ...setsForSelectedDate],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month,exercise_name' }
      );

    if (error) throw error;
  };

  const toggleSetLogged = async (exerciseName: string, setId: string) => {
    const targetExercise = exercises.find((exercise) => exercise.name === exerciseName);
    if (!targetExercise) return;

    const updatedExercise = {
      ...targetExercise,
      sets: targetExercise.sets.map((set) =>
        set.id === setId
          ? { ...set, logged: !set.logged, timestamp: new Date().toISOString(), date: toDateKey(selectedDate) }
          : set
      ),
    };

    setExercises((prev) =>
      prev.map((exercise) => exercise.name === exerciseName ? updatedExercise : exercise)
    );

    try {
      await persistExercise(updatedExercise);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update workout log');
      loadWorkoutLogs();
    }
  };

  const deleteExercise = (exerciseName: string) => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete the entire log for ${exerciseName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const targetExercise = exercises.find((exercise) => exercise.name === exerciseName);
            if (!targetExercise) return;

            const updatedExercise = { ...targetExercise, sets: [] };
            setExercises((prev) => prev.filter((exercise) => exercise.name !== exerciseName));

            try {
              await persistExercise(updatedExercise);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete workout log');
              loadWorkoutLogs();
            }
          },
        },
      ]
    );
  };

  const handleAddWorkout = async () => {
    if (
      !newExercise.name ||
      !newExercise.weight ||
      !newExercise.reps ||
      !newExercise.setsCount
    ) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const count = parseInt(newExercise.setsCount);
    if (isNaN(count) || count < 1) {
      Alert.alert('Error', 'Number of sets must be at least 1');
      return;
    }

    const newSets: WorkoutSet[] = Array.from({ length: count }).map(() => ({
      id: Date.now().toString() + Math.random(),
      weight: Number(newExercise.weight),
      reps: Number(newExercise.reps),
      logged: false,
      timestamp: new Date().toISOString(),
      date: toDateKey(selectedDate),
    }));

    const existingExercise = exercises.find((ex) => ex.name === newExercise.name);
    const updatedExercise = existingExercise
      ? { ...existingExercise, sets: [...existingExercise.sets, ...newSets] }
      : {
          name: newExercise.name,
          equipment: newExercise.equipment,
          sets: newSets,
        };

    setExercises((prev) =>
      existingExercise
        ? prev.map((ex) => ex.name === newExercise.name ? updatedExercise : ex)
        : [...prev, updatedExercise]
    );

    try {
      await persistExercise(updatedExercise);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save workout log');
      loadWorkoutLogs();
      return;
    }

    setNewExercise({
      name: '',
      weight: '',
      reps: '',
      equipment: 'Dumbbell',
      setsCount: '1',
    });
    setShowAddWorkoutModal(false);
  };

  const getCompletedSets = (exercise: Exercise) => {
    return exercise.sets.filter((set) => set.logged).length;
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Workout Log</Text>
            <Text style={styles.headerSubtitle}>
              Log your weights to keep progressing!
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/workout/history')}>
            <Text style={styles.historyLink}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateSelector}>
          <TouchableOpacity style={styles.dateSelectorButton}>
            <TouchableOpacity onPress={() => changeDate(-1)}>
              <ChevronLeft size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.dateSelectorText}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity onPress={() => changeDate(1)}>
              <ChevronRight size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading workout logs...</Text>
            </View>
          ) : exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No workout logs for this day</Text>
              <Text style={styles.emptyText}>Tap “Add a workout +” to log your first set for {formatDate(selectedDate)}.</Text>
            </View>
          ) : exercises.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.equipment && (
                    <Text style={styles.exerciseEquipment}>
                      {exercise.equipment}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Text style={styles.setsCount}>
                    {getCompletedSets(exercise)}/{exercise.sets.length} sets
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteExercise(exercise.name)}
                  >
                    <Trash2 size={20} color="red" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.weightColumn]}>
                  WEIGHT
                </Text>
                <Text style={[styles.tableHeaderText, styles.repsColumn]}>
                  REPS
                </Text>
                <Text style={[styles.tableHeaderText, styles.logColumn]}>
                  LOG
                </Text>
              </View>

              {exercise.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  {editingSetId === set.id ? (
                    <TextInput
                      style={[
                        styles.setValue,
                        styles.weightColumn,
                        {
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          padding: 4,
                          borderRadius: 4,
                        },
                      ]}
                      value={editingWeight}
                      onChangeText={setEditingWeight}
                      keyboardType="numeric"
                      autoFocus
                      onBlur={() => {
                        const updatedExercise = {
                          ...exercise,
                          sets: exercise.sets.map((s) =>
                            s.id === set.id
                              ? { ...s, weight: Number(editingWeight) || s.weight }
                              : s
                          ),
                        };
                        setExercises((prev) =>
                          prev.map((ex) => ex.name === exercise.name ? updatedExercise : ex)
                        );
                        persistExercise(updatedExercise).catch((error: any) =>
                          Alert.alert('Error', error.message || 'Failed to update set')
                        );
                        setEditingSetId(null);
                      }}
                      onSubmitEditing={() => {
                        const updatedExercise = {
                          ...exercise,
                          sets: exercise.sets.map((s) =>
                            s.id === set.id
                              ? { ...s, weight: Number(editingWeight) || s.weight }
                              : s
                          ),
                        };
                        setExercises((prev) =>
                          prev.map((ex) => ex.name === exercise.name ? updatedExercise : ex)
                        );
                        persistExercise(updatedExercise).catch((error: any) =>
                          Alert.alert('Error', error.message || 'Failed to update set')
                        );
                        setEditingSetId(null);
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        const now = Date.now();
                        if (
                          (set as any).lastPress &&
                          now - (set as any).lastPress < 300
                        ) {
                          // double tap detected
                          setEditingSetId(set.id);
                          setEditingWeight(set.weight.toString());
                        }
                        (set as any).lastPress = now;
                      }}
                    >
                      <Text style={[styles.setValue, styles.weightColumn]}>
                        {set.weight} kg
                      </Text>
                    </TouchableOpacity>
                  )}

                  <Text style={[styles.setValue, styles.repsColumn]}>
                    {set.reps}
                  </Text>
                  <TouchableOpacity
                    style={[styles.logColumn, styles.logButton]}
                    onPress={() => toggleSetLogged(exercise.name, set.id)}
                  >
                    {set.logged && (
                      <Check size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSetButton}
                onPress={() => {
                  setCurrentExerciseForSet(exercise);
                  setNewSetData({ weight: '', reps: '' });
                  setShowAddSetModal(true);
                }}
              >
                <Text style={styles.addSetButtonText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Add a workout +"
            onPress={() => setShowAddWorkoutModal(true)}
          />
        </View>

        <Modal
          visible={showAddWorkoutModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddWorkoutModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddWorkoutModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'flex-end',
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Add Workout</Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Exercise Name</Text>
                      <TextInput
                        style={styles.input}
                        value={newExercise.name}
                        onChangeText={(text) =>
                          setNewExercise({ ...newExercise, name: text })
                        }
                        placeholder="e.g., Bench Press"
                        placeholderTextColor={theme.colors.inactive}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.input}
                        value={newExercise.weight}
                        onChangeText={(text) =>
                          setNewExercise({ ...newExercise, weight: text })
                        }
                        placeholder="e.g., 50"
                        placeholderTextColor={theme.colors.inactive}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Reps</Text>
                      <TextInput
                        style={styles.input}
                        value={newExercise.reps}
                        onChangeText={(text) =>
                          setNewExercise({ ...newExercise, reps: text })
                        }
                        placeholder="e.g., 12"
                        placeholderTextColor={theme.colors.inactive}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Number of Sets</Text>
                      <TextInput
                        style={styles.input}
                        value={newExercise.setsCount}
                        onChangeText={(text) =>
                          setNewExercise({ ...newExercise, setsCount: text })
                        }
                        placeholder="e.g., 3"
                        placeholderTextColor={theme.colors.inactive}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Equipment Type</Text>
                      <View style={styles.equipmentToggle}>
                        {['Dumbbell', 'Barbell', 'Cable', 'Machine'].map(
                          (type) => (
                            <TouchableOpacity
                              key={type}
                              style={[
                                styles.equipmentButton,
                                newExercise.equipment === type &&
                                  styles.equipmentButtonActive,
                              ]}
                              onPress={() =>
                                setNewExercise({
                                  ...newExercise,
                                  equipment: type,
                                })
                              }
                            >
                              <Text
                                style={[
                                  styles.equipmentButtonText,
                                  newExercise.equipment === type &&
                                    styles.equipmentButtonTextActive,
                                ]}
                              >
                                {type}
                              </Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </View>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={styles.modalCancelButton}
                        onPress={() => setShowAddWorkoutModal(false)}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalSaveButton}
                        onPress={handleAddWorkout}
                      >
                        <LinearGradient
                          colors={[
                            theme.colors.primary,
                            theme.colors.primaryDark,
                          ]}
                          style={styles.modalSaveGradient}
                        >
                          <Text style={styles.modalSaveText}>Save Set</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* Add Set Modal */}
        <Modal
          visible={showAddSetModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddSetModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddSetModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'flex-end',
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Add New Set</Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.input}
                        value={newSetData.weight}
                        onChangeText={(text) =>
                          setNewSetData({ ...newSetData, weight: text })
                        }
                        placeholder="e.g., 50"
                        placeholderTextColor={theme.colors.inactive}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Reps</Text>
                      <TextInput
                        style={styles.input}
                        value={newSetData.reps}
                        onChangeText={(text) =>
                          setNewSetData({ ...newSetData, reps: text })
                        }
                        placeholder="e.g., 12"
                        placeholderTextColor={theme.colors.inactive}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={styles.modalCancelButton}
                        onPress={() => setShowAddSetModal(false)}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalSaveButton}
                        onPress={async () => {
                          if (
                            !currentExerciseForSet ||
                            !newSetData.weight ||
                            !newSetData.reps
                          ) {
                            Alert.alert(
                              'Error',
                              'Please fill in weight and reps'
                            );
                            return;
                          }
                          const newSet: WorkoutSet = {
                            id: Date.now().toString() + Math.random(),
                            weight: Number(newSetData.weight),
                            reps: Number(newSetData.reps),
                            logged: false,
                            timestamp: new Date().toISOString(),
                            date: toDateKey(selectedDate),
                          };
                          const targetExercise =
                            exercises.find((ex) => ex.name === currentExerciseForSet.name) ??
                            currentExerciseForSet;
                          const updatedExercise = {
                            ...targetExercise,
                            sets: [...targetExercise.sets, newSet],
                          };
                          setExercises((prev) =>
                            prev.map((ex) =>
                              ex.name === currentExerciseForSet.name ? updatedExercise : ex
                            )
                          );
                          try {
                            await persistExercise(updatedExercise);
                          } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to add set');
                            loadWorkoutLogs();
                          }
                          setShowAddSetModal(false);
                        }}
                      >
                        <LinearGradient
                          colors={[
                            theme.colors.primary,
                            theme.colors.primaryDark,
                          ]}
                          style={styles.modalSaveGradient}
                        >
                          <Text style={styles.modalSaveText}>Add Set</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
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
  headerContent: {
    flex: 1,
  },
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
  historyLink: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dateSelector: {
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  dateSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 16,
    paddingHorizontal: 10,
    minWidth: 260,
  },
  dateSelectorText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  exerciseCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 4,
  },
  exerciseEquipment: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
  setsCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.secondary,
    letterSpacing: 0.5,
  },
  weightColumn: {
    flex: 1,
  },
  repsColumn: {
    flex: 1,
    textAlign: 'center',
  },
  logColumn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  setValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '500',
  },
  logButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.primary,
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
  addSetButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  addSetButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  emptyState: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
  },
  equipmentToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.inactive,
  },
  equipmentButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  equipmentButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  equipmentButtonTextActive: { color: theme.colors.white },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  modalSaveGradient: { padding: 16, alignItems: 'center' },
  modalSaveText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600',
  },
});
