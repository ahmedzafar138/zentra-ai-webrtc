/*
  # Add History Tables for Logs, Meals, and Steps

  1. New Tables
    - `user_logs_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `month` (text, format: YYYY-MM)
      - `exercise_name` (text)
      - `muscle_group` (text)
      - `sets` (jsonb array of set data)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_meal_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `week_start_date` (date)
      - `meal_plan_data` (jsonb, full weekly plan)
      - `created_at` (timestamp)
    
    - `user_steps_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `month` (text, format: YYYY-MM)
      - `daily_data` (jsonb, array of daily step records)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `shopping_lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `meal_plan_id` (uuid, foreign key to user_meal_history)
      - `items` (jsonb, array of shopping list items)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to read/write their own data

  3. Important Notes
    - All data is user-specific and properly secured
    - No hardcoded values - all history is dynamic
    - Monthly and weekly aggregation for efficient storage
*/

-- User Logs History Table
CREATE TABLE IF NOT EXISTS user_logs_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  month text NOT NULL,
  exercise_name text NOT NULL,
  muscle_group text NOT NULL,
  sets jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month, exercise_name)
);

ALTER TABLE user_logs_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs history"
  ON user_logs_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs history"
  ON user_logs_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs history"
  ON user_logs_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs history"
  ON user_logs_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Meal History Table
CREATE TABLE IF NOT EXISTS user_meal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  meal_plan_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

ALTER TABLE user_meal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meal history"
  ON user_meal_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal history"
  ON user_meal_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal history"
  ON user_meal_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal history"
  ON user_meal_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Steps History Table
CREATE TABLE IF NOT EXISTS user_steps_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  month text NOT NULL,
  daily_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE user_steps_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own steps history"
  ON user_steps_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own steps history"
  ON user_steps_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own steps history"
  ON user_steps_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own steps history"
  ON user_steps_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Shopping Lists Table
CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  meal_plan_id uuid REFERENCES user_meal_history(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shopping lists"
  ON shopping_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping lists"
  ON shopping_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping lists"
  ON shopping_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping lists"
  ON shopping_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add steps_goal to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'steps_goal'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN steps_goal integer DEFAULT 8000;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_logs_history_user_month ON user_logs_history(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_meal_history_user_week ON user_meal_history(user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_steps_history_user_month ON user_steps_history(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id, created_at DESC);
