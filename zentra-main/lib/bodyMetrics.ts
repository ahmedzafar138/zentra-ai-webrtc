export type BodyMetricsProfile = {
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
  onboarding_completed?: boolean | null;
};

const toPositiveNumber = (value: number | string | null | undefined) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

export const calculateBmi = (
  heightCm: number | string | null | undefined,
  weightKg: number | string | null | undefined
) => {
  const height = toPositiveNumber(heightCm);
  const weight = toPositiveNumber(weightKg);

  if (!height || !weight) return null;

  const heightM = height / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
};

export const hasCompletedBodyMetrics = (profile: BodyMetricsProfile | null | undefined) => {
  return Boolean(
    profile?.onboarding_completed &&
      toPositiveNumber(profile.height_cm) &&
      toPositiveNumber(profile.weight_kg)
  );
};

export const getBmiCategory = (bmi: number | null | undefined) => {
  if (!bmi) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};
