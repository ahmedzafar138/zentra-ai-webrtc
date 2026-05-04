import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import ScrollPicker from '@/components/ScrollPicker';
import { supabase } from '@/lib/supabase';
import { calculateBmi } from '@/lib/bodyMetrics';

type WeightUnit = 'kg' | 'lb';

export default function WeightScreen() {
  const params = useLocalSearchParams();
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [weightKg, setWeightKg] = useState(70);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const kgToLbs = (kg: number) => Math.round(kg / 0.453592);
  const lbsToKg = (lbs: number) => Math.round(lbs * 0.453592);

  const kgValues = useMemo(() => {
    const values = [];
    for (let i = 35; i <= 220; i++) {
      values.push(`${i} kg`);
    }
    return values;
  }, []);

  const lbValues = useMemo(() => {
    const values = [];
    for (let i = 80; i <= 485; i++) {
      values.push({ display: `${i} lb`, kg: lbsToKg(i) });
    }
    return values;
  }, []);

  const handleWeightChange = (index: number) => {
    if (unit === 'kg') {
      setWeightKg(35 + index);
    } else {
      setWeightKg(lbValues[index].kg);
    }
  };

  const getWeightIndex = () => {
    if (unit === 'kg') {
      return weightKg - 35;
    } else {
      return lbValues.findIndex((v) => v.kg === weightKg) || 0;
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const heightCm = Number(params.heightCm);
      const bmi = calculateBmi(heightCm, weightKg);

      if (!bmi) throw new Error('Please select valid height and weight values');

      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const metricsData = {
        height_cm: heightCm,
        weight_kg: weightKg,
        height_unit: params.heightUnit as string,
        weight_unit: unit,
        bmi,
        onboarding_completed: true,
      };

      const { error } = existingProfile
        ? await supabase
            .from('user_profiles')
            .update(metricsData)
            .eq('id', user.id)
        : await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              first_name: user.user_metadata?.first_name || 'Zentra',
              last_name: user.user_metadata?.last_name || 'User',
              ...metricsData,
            });

      if (error) throw error;

      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save metrics');
    } finally {
      setLoading(false);
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
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Almost there!</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Weight</Text>

              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitButton, unit === 'kg' && styles.unitButtonActive]}
                  onPress={() => setUnit('kg')}
                >
                  <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, unit === 'lb' && styles.unitButtonActive]}
                  onPress={() => setUnit('lb')}
                >
                  <Text style={[styles.unitText, unit === 'lb' && styles.unitTextActive]}>
                    lb
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollPicker
                values={unit === 'kg' ? kgValues : lbValues.map((v) => v.display)}
                selectedIndex={getWeightIndex()}
                onValueChange={handleWeightChange}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Complete"
            onPress={handleComplete}
            disabled={loading}
          />
        </View>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 32,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 24,
    textAlign: "center"
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: 32,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  unitButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  unitText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
