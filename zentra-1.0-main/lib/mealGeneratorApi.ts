import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { DayMealPlan, WeeklyMealPlan } from './mealPlanStore';

const configuredBaseUrl =
  Constants.expoConfig?.extra?.mealGeneratorApiBaseUrl ??
  process.env.EXPO_PUBLIC_MEAL_GENERATOR_API_BASE_URL;

function normalizeLocalBaseUrl(url: string) {
  const trimmedUrl = url.trim().replace(/\/$/, '');
  const localHttpOnlyHosts = [
    'localhost',
    '127.0.0.1',
    '10.0.2.2',
  ];

  if (
    trimmedUrl.startsWith('https://') &&
    localHttpOnlyHosts.some((host) => trimmedUrl.includes(`://${host}`))
  ) {
    return trimmedUrl.replace('https://', 'http://');
  }

  return trimmedUrl;
}

function inferDevelopmentBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const MEAL_GENERATOR_API_BASE_URL =
  normalizeLocalBaseUrl(configuredBaseUrl ?? inferDevelopmentBaseUrl());

function getCandidateBaseUrls() {
  const candidates = [
    configuredBaseUrl,
    inferDevelopmentBaseUrl(),
    Platform.OS === 'android' ? 'http://10.0.2.2:8000' : undefined,
  ]
    .filter(Boolean)
    .map((url) => normalizeLocalBaseUrl(url as string));

  return Array.from(new Set(candidates));
}

export type MealPlanRequest = {
  userProfile: string;
  dietaryPreference?: string;
  additionalRequirements?: string;
};

export type RecipeResponse = {
  meal_name?: string;
  ingredients?: {
    heading?: string;
    items?: string[];
  };
  instructions?: {
    heading?: string;
    steps?: string[];
  };
  [key: string]: unknown;
};

export type ShoppingList = Record<string, string[]>;

function parseJsonMaybe<T>(value: unknown): T {
  if (typeof value !== 'string') {
    return value as T;
  }

  const cleaned = value
    .replace(/```json\s*/i, '')
    .replace(/```/g, '')
    .trim();
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonText = lastBrace >= 0 ? cleaned.slice(0, lastBrace + 1) : cleaned;

  return JSON.parse(jsonText) as T;
}

function isMealPlanItem(value: any) {
  return Boolean(
    value?.food &&
      value?.portion &&
      value?.macros &&
      Number.isFinite(Number(value.macros.energy_kcal)) &&
      Number.isFinite(Number(value.macros.protein_g)) &&
      Number.isFinite(Number(value.macros.carbohydrates_g)) &&
      Number.isFinite(Number(value.macros.fat_g))
  );
}

function normalizeDayPlan(value: any): DayMealPlan | null {
  if (!value) return null;

  const dayPlan = {
    breakfast: value.breakfast,
    lunch: value.lunch,
    dinner: value.dinner,
    snacks: value.snacks ?? value.snack,
  };

  if (
    !isMealPlanItem(dayPlan.breakfast) ||
    !isMealPlanItem(dayPlan.lunch) ||
    !isMealPlanItem(dayPlan.dinner) ||
    !isMealPlanItem(dayPlan.snacks)
  ) {
    return null;
  }

  return dayPlan as DayMealPlan;
}

function normalizeWeeklyPlan(value: unknown): WeeklyMealPlan {
  const parsed = parseJsonMaybe<any>(value);
  const candidate = parsed?.meal_plan ?? parsed?.plan ?? parsed;
  const weeklyPlan: WeeklyMealPlan = {};

  for (let index = 1; index <= 7; index += 1) {
    const key = `day${index}`;
    const dayPlan = normalizeDayPlan(candidate?.[key]);

    if (!dayPlan) {
      throw new Error(`Weekly meal plan is missing a complete ${key}.`);
    }

    weeklyPlan[key] = dayPlan;
  }

  return weeklyPlan;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let lastNetworkError = '';

  for (const baseUrl of getCandidateBaseUrls()) {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error: any) {
      lastNetworkError = `${baseUrl}: ${error.message ?? 'Network request failed'}`;
      continue;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.detail ?? `Meal generator request failed at ${baseUrl}.`;
      throw new Error(message);
    }

    return data as T;
  }

  throw new Error(
    `Unable to reach meal generator. Tried: ${getCandidateBaseUrls().join(', ')}. ${lastNetworkError}`.trim()
  );
}

export async function generateWeeklyMealPlan({
  userProfile,
  dietaryPreference,
  additionalRequirements,
}: MealPlanRequest): Promise<WeeklyMealPlan> {
  const data = await postJson<{ success: boolean; meal_plan?: unknown; message: string }>(
    '/api/v1/meal-planning/generate-weekly',
    {
      user_profile: userProfile,
      dietary_preferences: dietaryPreference,
      additional_requirements: additionalRequirements,
    }
  );

  if (!data.success || !data.meal_plan) {
    throw new Error(data.message || 'Meal generator returned no meal plan.');
  }

  return normalizeWeeklyPlan(data.meal_plan);
}

export async function generateDailyMealPlan({
  userProfile,
  dietaryPreference,
  additionalRequirements,
}: MealPlanRequest): Promise<DayMealPlan> {
  const data = await postJson<{ success: boolean; meal_plan?: unknown; message: string }>(
    '/api/v1/meal-planning/generate-daily',
    {
      user_profile: userProfile,
      dietary_preferences: dietaryPreference,
      additional_requirements: additionalRequirements,
    }
  );

  if (!data.success || !data.meal_plan) {
    throw new Error(data.message || 'Meal generator returned no meal plan.');
  }

  const parsed = parseJsonMaybe<{ day1: DayMealPlan }>(data.meal_plan);
  const dayPlan = normalizeDayPlan(parsed.day1);

  if (!dayPlan) {
    throw new Error('Daily meal plan was generated in an unexpected format.');
  }

  return dayPlan;
}

export async function generateRecipe(mealName: string): Promise<RecipeResponse> {
  return postJson<RecipeResponse>('/api/v1/recipe/generate-recipe', {
    meal_name: mealName,
  });
}

export async function generateDailyRecipes(
  meals: Record<string, string>
): Promise<Record<string, RecipeResponse>> {
  return postJson<Record<string, RecipeResponse>>(
    '/api/v1/recipe/generate-daily-recipes',
    { meals }
  );
}

export async function generateShoppingList(
  weeklyPlan: WeeklyMealPlan
): Promise<ShoppingList> {
  const shoppingPayload = Object.fromEntries(
    Object.entries(weeklyPlan).map(([dayKey, dayPlan]) => [
      dayKey,
      Object.fromEntries(
        Object.entries(dayPlan).map(([mealKey, meal]) => [
          mealKey,
          {
            food: meal.food,
            portion: meal.portion,
          },
        ])
      ),
    ])
  );

  const data = await postJson<{ data: ShoppingList }>(
    '/api/v1/shopping_list/generate',
    shoppingPayload
  );

  return data.data;
}
