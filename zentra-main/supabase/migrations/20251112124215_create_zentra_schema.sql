-- Zentra AI Fitness Trainer Database Schema
-- 
-- Overview:
-- Complete database schema for the Zentra fitness app including user profiles,
-- onboarding data, workout logs, meal plans, step tracking, and AI chat history.
--
-- New Tables:
-- 1. user_profiles - User profile and body metrics
-- 2. step_tracking - Daily step counter data
-- 3. meal_plans - Weekly meal plan configurations
-- 4. meal_plan_items - Individual meals in a plan
-- 5. recipes - Recipe database
-- 6. workout_logs - Form correction workout history
-- 7. ai_chat_conversations - AI chat threads
-- 8. ai_chat_messages - Individual chat messages
-- 9. blog_posts - Fitness blog articles
-- 10. saved_blogs - User's saved blog posts
--
-- Security: RLS enabled on all tables with appropriate policies

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  height_cm numeric,
  weight_kg numeric,
  height_unit text DEFAULT 'cm' CHECK (height_unit IN ('cm', 'ft-in')),
  weight_unit text DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step Tracking Table
CREATE TABLE IF NOT EXISTS step_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  steps integer DEFAULT 0,
  goal integer DEFAULT 8000,
  kcal numeric DEFAULT 0,
  distance_km numeric DEFAULT 0,
  active_minutes integer DEFAULT 0,
  streak_days integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE step_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own step data"
  ON step_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own step data"
  ON step_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own step data"
  ON step_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recipes Table (shared resource)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  calories integer DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  prep_time_min integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipes are publicly readable"
  ON recipes FOR SELECT
  TO authenticated
  USING (true);

-- Meal Plans Table
CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  culinary_preference text,
  dietary_preference text,
  goal text,
  total_calories integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meal plans"
  ON meal_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal plans"
  ON meal_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal plans"
  ON meal_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal plans"
  ON meal_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Meal Plan Items Table
CREATE TABLE IF NOT EXISTS meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meal plan items"
  ON meal_plan_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_items.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own meal plan items"
  ON meal_plan_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_items.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meal plan items"
  ON meal_plan_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_items.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_items.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own meal plan items"
  ON meal_plan_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_items.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

-- Workout Logs Table
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  muscle_group text NOT NULL,
  exercise_name text NOT NULL,
  correct_reps integer DEFAULT 0,
  incorrect_reps integer DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workout logs"
  ON workout_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout logs"
  ON workout_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout logs"
  ON workout_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout logs"
  ON workout_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Chat Conversations Table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversations"
  ON ai_chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON ai_chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_chat_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Chat Messages Table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON ai_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages"
  ON ai_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

-- Blog Posts Table (public content)
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  snippet text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  read_time_min integer DEFAULT 5,
  published_at timestamptz DEFAULT now(),
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts are publicly readable"
  ON blog_posts FOR SELECT
  TO authenticated
  USING (true);

-- Saved Blogs Table
CREATE TABLE IF NOT EXISTS saved_blogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blog_post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, blog_post_id)
);

ALTER TABLE saved_blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved blogs"
  ON saved_blogs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved blogs"
  ON saved_blogs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved blogs"
  ON saved_blogs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_step_tracking_user_date ON step_tracking(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON meal_plans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_blogs_user ON saved_blogs(user_id, created_at DESC);