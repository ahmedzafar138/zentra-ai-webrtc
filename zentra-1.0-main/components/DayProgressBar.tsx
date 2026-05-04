import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from '@/constants/theme';

interface DayData {
  date: string;
  completionPercent: number;
  label: string;
}

interface DayProgressBarProps {
  days: DayData[];
  onDayPress?: (day: DayData) => void;
}

export default function DayProgressBar({ days, onDayPress }: DayProgressBarProps) {
  const getGradientColor = (percent: number) => {
    const lightOrange = { r: 255, g: 179, b: 102 };
    const darkOrange = { r: 255, g: 106, b: 0 };

    const r = Math.round(lightOrange.r + (darkOrange.r - lightOrange.r) * (percent / 100));
    const g = Math.round(lightOrange.g + (darkOrange.g - lightOrange.g) * (percent / 100));
    const b = Math.round(lightOrange.b + (darkOrange.b - lightOrange.b) * (percent / 100));

    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {days.map((day, index) => {
          const color = getGradientColor(day.completionPercent);

          return (
            <TouchableOpacity
              key={index}
              style={styles.dayContainer}
              onPress={() => onDayPress?.(day)}
              activeOpacity={0.7}
            >
              <View style={[styles.dayIcon, { backgroundColor: color }]}>
                <Text style={styles.dayLabel}>{day.label}</Text>
              </View>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${day.completionPercent}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={styles.percentText}>{Math.round(day.completionPercent)}%</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 16,
  },
  dayContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  dayIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  barContainer: {
    width: 30,
    height: 100,
    backgroundColor: theme.colors.inactive,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  percentText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginTop: 8,
  },
});
