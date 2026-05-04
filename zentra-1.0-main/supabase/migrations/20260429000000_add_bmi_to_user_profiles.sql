-- Persist calculated BMI with the user's body metrics.
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS bmi numeric;
