import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import ScrollPicker from '@/components/ScrollPicker';

type HeightUnit = 'cm' | 'ft-in';

export default function HeightScreen() {
  const [unit, setUnit] = useState<HeightUnit>('cm');
  const [heightCm, setHeightCm] = useState(173);
  const router = useRouter();

  const cmToFeet = (cm: number) => {
    const inches = Math.round(cm / 2.54);
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return { feet, inches: remainingInches };
  };

  const feetToCm = (feet: number, inches: number) => {
    return Math.round((feet * 12 + inches) * 2.54);
  };

  const cmValues = useMemo(() => {
    const values = [];
    for (let i = 120; i <= 220; i++) {
      values.push(`${i} cm`);
    }
    return values;
  }, []);

  const ftInValues = useMemo(() => {
    const values = [];
    for (let feet = 4; feet <= 7; feet++) {
      for (let inches = 0; inches < 12; inches++) {
        const cm = feetToCm(feet, inches);
        if (cm >= 120 && cm <= 220) {
          values.push({ display: `${feet}'${inches}"`, cm });
        }
      }
    }
    return values;
  }, []);

  const handleNext = () => {
    router.push({
      pathname: '/body-metrics/weight',
      params: { heightCm: heightCm.toString(), heightUnit: unit },
    });
  };

  const handleHeightChange = (index: number) => {
    if (unit === 'cm') {
      setHeightCm(120 + index);
    } else {
      setHeightCm(ftInValues[index].cm);
    }
  };

  const getHeightIndex = () => {
    if (unit === 'cm') {
      return heightCm - 120;
    } else {
      const index = ftInValues.findIndex((v) => v.cm === heightCm);
      if (index !== -1) return index;

      let closestIndex = 0;
      let minDiff = Math.abs(ftInValues[0].cm - heightCm);

      for (let i = 1; i < ftInValues.length; i++) {
        const diff = Math.abs(ftInValues[i].cm - heightCm);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      return closestIndex;
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
            <Text style={styles.title}>Let's get to know you better!</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Height</Text>

              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitButton, unit === 'cm' && styles.unitButtonActive]}
                  onPress={() => setUnit('cm')}
                >
                  <Text style={[styles.unitText, unit === 'cm' && styles.unitTextActive]}>
                    cm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, unit === 'ft-in' && styles.unitButtonActive]}
                  onPress={() => setUnit('ft-in')}
                >
                  <Text style={[styles.unitText, unit === 'ft-in' && styles.unitTextActive]}>
                    ft-in
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollPicker
                values={unit === 'cm' ? cmValues : ftInValues.map((v) => v.display)}
                selectedIndex={getHeightIndex()}
                onValueChange={handleHeightChange}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Next" onPress={handleNext} />
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
