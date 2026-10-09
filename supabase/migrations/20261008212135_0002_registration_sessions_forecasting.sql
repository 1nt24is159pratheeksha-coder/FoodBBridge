/*
# WhatsApp Registration, Conversation Sessions, Matching, Forecasting & Procurement

## Purpose
Extends the existing ResQFood schema to support:
1. Conversational WhatsApp registration for kitchens and NGOs
2. Server-side conversation session/state management
3. Matching/scoring engine for ranking NGOs against surplus food
4. Demand forecasting with weather integration
5. Smart procurement (Bill of Materials / inventory)

## Changes to existing tables

### kitchens (add columns)
- email text — optional contact email
- city text — city for matching
- latitude numeric(10,7) — geo location
- longitude numeric(10,7) — geo location
- organization_type text — e.g. restaurant, cafeteria, hotel, hospital, school
- operating_hours text — e.g. "8 AM – 10 PM"
- daily_meals integer — approximate daily meal volume
- reg_data jsonb — flexible storage for in-progress registration fields

### ngos (add columns)
- email text — optional contact email
- city text — city for matching
- latitude numeric(10,7)
- longitude numeric(10,7)
- organization_type text — e.g. shelter, food bank, orphanage
- capacity_meals integer — beneficiary capacity
- food_requirements text — preferred food types / dietary needs
- availability text — operating hours for receiving food
- reg_data jsonb — flexible storage for in-progress registration fields

### surplus_food (add columns)
- urgency text — NORMAL, HIGH, URGENT
- created_channel text — 'whatsapp' or 'admin_simulator' (source already exists but we add channel for clarity)

### food_assessments (add columns)
- visual_quality text — Good, Fair, Poor
- freshness text — Appears fresh, Signs of degradation, Spoiled
- confidence_percent integer — AI confidence 0-100
- safety_status text — ELIGIBLE, REVIEW_REQUIRED, URGENT, REJECTED
- usable_window_hours integer — estimated usable time window
- storage_condition text — e.g. hot, cold, room temperature

## New tables

### conversation_sessions
Stores per-phone-number conversation state for the WhatsApp engine.
- id uuid PK
- phone text UNIQUE NOT NULL — normalized phone number
- role text — 'kitchen' or 'ngo' or null (pre-registration)
- entity_id uuid — FK to kitchens or ngos once registered
- state text NOT NULL DEFAULT 'new' — state machine state
- pending_data jsonb — in-progress registration/assessment/surplus data
- channel text NOT NULL DEFAULT 'admin_simulator' — 'whatsapp' or 'admin_simulator'
- created_at timestamptz
- updated_at timestamptz

### ngo_matches
Stores matching scores for surplus food → NGO ranking.
- id uuid PK
- surplus_id uuid FK to surplus_food
- ngo_id uuid FK to ngos
- distance_score numeric — 0-1 normalized
- compatibility_score numeric — 0-1
- capacity_score numeric — 0-1
- urgency_score numeric — 0-1
- verification_score numeric — 0-1
- total_score numeric — weighted composite
- rank integer — ranking position
- created_at timestamptz

### demand_forecasts
Stores demand prediction results.
- id uuid PK
- kitchen_id uuid FK to kitchens
- forecast_date date — the date being forecast
- predicted_demand integer — predicted meals
- recommended_production_low integer — lower bound
- recommended_production_high integer — upper bound
- confidence_level text — low, medium, high
- historical_baseline integer — simple average baseline
- drivers jsonb — influencing factors (Friday effect, rain, etc.)
- weather_available boolean DEFAULT false
- created_at timestamptz

### weather_cache
Caches weather data per city/date.
- id uuid PK
- city text NOT NULL
- forecast_date date NOT NULL
- temperature_c numeric
- precipitation_mm numeric
- condition_text text — sunny, cloudy, rain, etc.
- is_forecast boolean DEFAULT true
- fetched_at timestamptz
- UNIQUE(city, forecast_date)

### bom_recipes
Bill of Materials recipes for procurement calculation.
- id uuid PK
- kitchen_id uuid FK to kitchens
- dish_name text NOT NULL
- servings_per_recipe integer DEFAULT 1
- ingredients jsonb NOT NULL — [{name, unit, amount_per_serving}]

### inventory_items
Current inventory for procurement.
- id uuid PK
- kitchen_id uuid FK to kitchens
- ingredient_name text NOT NULL
- quantity numeric
- unit text
- updated_at timestamptz
- UNIQUE(kitchen_id, ingredient_name)

## Security
- All new tables have RLS enabled.
- Existing WhatsApp tables already have RLS with service_role only (no client policies).
- New tables follow the same pattern: service_role access only, no anon/authenticated policies.
- The admin web app reads data through server functions using supabaseAdmin.
*/

-- ============================================================
-- kitchens: add registration columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS email text;
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS city text;
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS latitude numeric(10,7);
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS longitude numeric(10,7);
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS organization_type text;
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS operating_hours text;
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS daily_meals integer;
  ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS reg_data jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- ngos: add registration columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS email text;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS city text;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS latitude numeric(10,7);
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS longitude numeric(10,7);
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS organization_type text;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS capacity_meals integer;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS food_requirements text;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS availability text;
  ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS reg_data jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- surplus_food: add columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.surplus_food ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'NORMAL';
  ALTER TABLE public.surplus_food ADD COLUMN IF NOT EXISTS created_channel text DEFAULT 'whatsapp';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- food_assessments: add columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS visual_quality text;
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS freshness text;
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS confidence_percent integer;
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS safety_status text;
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS usable_window_hours integer;
  ALTER TABLE public.food_assessments ADD COLUMN IF NOT EXISTS storage_condition text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- conversation_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  role text,
  entity_id uuid,
  state text NOT NULL DEFAULT 'new',
  pending_data jsonb DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'admin_simulator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.conversation_sessions TO service_role;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_phone ON public.conversation_sessions(phone);

-- ============================================================
-- ngo_matches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ngo_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surplus_id uuid NOT NULL REFERENCES public.surplus_food(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  distance_score numeric DEFAULT 0,
  compatibility_score numeric DEFAULT 0,
  capacity_score numeric DEFAULT 0,
  urgency_score numeric DEFAULT 0,
  verification_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  rank integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ngo_matches TO service_role;
ALTER TABLE public.ngo_matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ngo_matches_surplus ON public.ngo_matches(surplus_id);

-- ============================================================
-- demand_forecasts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.demand_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  predicted_demand integer NOT NULL DEFAULT 0,
  recommended_production_low integer DEFAULT 0,
  recommended_production_high integer DEFAULT 0,
  confidence_level text DEFAULT 'low',
  historical_baseline integer DEFAULT 0,
  drivers jsonb DEFAULT '{}'::jsonb,
  weather_available boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demand_forecasts TO service_role;
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_kitchen_date ON public.demand_forecasts(kitchen_id, forecast_date);

-- ============================================================
-- weather_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  forecast_date date NOT NULL,
  temperature_c numeric,
  precipitation_mm numeric,
  condition_text text,
  is_forecast boolean DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, forecast_date)
);
GRANT ALL ON public.weather_cache TO service_role;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- bom_recipes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bom_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  dish_name text NOT NULL,
  servings_per_recipe integer DEFAULT 1,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bom_recipes TO service_role;
ALTER TABLE public.bom_recipes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- inventory_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kitchen_id, ingredient_name)
);
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;