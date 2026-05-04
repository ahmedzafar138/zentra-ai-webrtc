import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { theme } from '@/constants/theme';

interface ScrollPickerProps {
  values: string[];
  selectedIndex: number;
  onValueChange: (index: number) => void;
}

const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 5;

export default function ScrollPicker({ values, selectedIndex, onValueChange }: ScrollPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: true,
    });
  }, [selectedIndex]);

  const handleScroll = (event: any) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    if (index >= 0 && index < values.length && index !== selectedIndex) {
      onValueChange(index);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.selectedIndicator} />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {values.map((value, index) => {
          const isSelected = index === selectedIndex;
          const distance = Math.abs(index - selectedIndex);
          const opacity = Math.max(0.3, 1 - distance * 0.35);

          return (
            <View key={index} style={[styles.item, { height: ITEM_HEIGHT }]}>
              <Text
                style={[
                  styles.itemText,
                  isSelected && styles.selectedText,
                  { opacity },
                ]}
              >
                {value}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: 'relative',
  },
  selectedIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.primary,
    zIndex: 1,
    pointerEvents: 'none',
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.white,
    fontWeight: '500',
  },
  selectedText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
  },
});
