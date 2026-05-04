import type { ShoppingList } from './mealGeneratorApi';

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type MealPlanItem = {
  food: string;
  portion: string;
  macros: {
    protein_g: number;
    fat_g: number;
    carbohydrates_g: number;
    energy_kcal: number;
  };
};

export type DayMealPlan = Record<MealKey, MealPlanItem>;
export type WeeklyMealPlan = Record<string, DayMealPlan>;

type GeneratedMealPlanState = {
  culinaryPreference?: string;
  dietaryPreference?: string;
  goal?: string;
  dailyPlan?: DayMealPlan;
  weekStartDate?: string;
  weeklyPlan?: WeeklyMealPlan;
  shoppingList?: ShoppingList;
};

const state: GeneratedMealPlanState = {};

export function setGeneratedMealPlan(nextState: GeneratedMealPlanState) {
  if (nextState.weeklyPlan || nextState.dailyPlan) {
    state.shoppingList = undefined;
  }

  Object.assign(state, nextState);
}

export function getGeneratedMealPlan() {
  return state;
}

export function setGeneratedShoppingList(shoppingList: ShoppingList) {
  state.shoppingList = shoppingList;
}
