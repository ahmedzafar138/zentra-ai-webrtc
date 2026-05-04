import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import * as Clipboard from 'expo-clipboard';
import { generateShoppingList, type ShoppingList } from '@/lib/mealGeneratorApi';
import { getGeneratedMealPlan, setGeneratedShoppingList } from '@/lib/mealPlanStore';
import { supabase } from '@/lib/supabase';

export default function ShoppingListScreen() {
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingList>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadShoppingList() {
      const { weeklyPlan, shoppingList: cachedList } = getGeneratedMealPlan();

      if (cachedList) {
        setShoppingList(cachedList);
        setLoading(false);
        return;
      }

      if (!weeklyPlan) {
        setLoading(false);
        return;
      }

      try {
        const data = await generateShoppingList(weeklyPlan);
        if (cancelled) return;

        setShoppingList(data);
        setGeneratedShoppingList(data);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: saveError } = await supabase
            .from('shopping_lists')
            .insert({
              user_id: user.id,
              items: data,
            });

          if (saveError) {
            throw saveError;
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert('Shopping list error', error.message || 'Failed to generate shopping list.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadShoppingList();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCheck = (category: string, idx: number) => {
    const key = `${category}-${idx}`;
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCopy = async () => {
    let listText = '';
    Object.entries(shoppingList).forEach(([category, items]) => {
      listText += `${category}:\n`;
      items.forEach(item => {
        listText += `- ${item}\n`;
      });
      listText += '\n';
    });

    await Clipboard.setStringAsync(listText);
    Alert.alert('Success', 'Shopping list copied to clipboard');
  };

  const hasItems = Object.keys(shoppingList).length > 0;

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

          <Text style={styles.headerTitle}>Shopping List</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <Text style={styles.emptyText}>Generating your shopping list...</Text>
          ) : !hasItems ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No shopping list yet.</Text>
              <Text style={styles.emptySubtext}>Generate a weekly meal plan first.</Text>
            </View>
          ) : Object.entries(shoppingList).map(([category, items], index) => (
            <View key={index} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>

              {items.map((item, idx) => {
                const key = `${category}-${idx}`;
                const isChecked = checkedItems[key];

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.itemRow}
                    onPress={() => toggleCheck(category, idx)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isChecked && styles.checkboxChecked
                      ]}
                    >
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>

                    <Text
                      style={[
                        styles.itemName,
                        isChecked && {
                          textDecorationLine: 'line-through',
                          opacity: 0.6,
                        },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {hasItems && (
            <PrimaryButton
              title="Copy Entire Shopping List"
              onPress={handleCopy}
              style={styles.button}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  categorySection: { marginBottom: 24 },
  categoryTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -1,
  },
  itemName: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.inactive,
  },
  button: {
    marginTop: 16,
    marginBottom: 16,
  },
});
