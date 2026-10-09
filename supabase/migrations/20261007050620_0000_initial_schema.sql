CREATE TABLE public.kitchens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  phone text NOT NULL UNIQUE,
  address text,
  status text NOT NULL DEFAULT 'approved',
  conversation_state text NOT NULL DEFAULT 'idle',
  pending_assessment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kitchens TO service_role;
ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid REFERENCES public.kitchens(id) ON DELETE SET NULL,
  from_phone text,
  provider_message_id text UNIQUE,
  message_type text NOT NULL,
  message_text text,
  media_reference text,
  direction text NOT NULL,
  mode text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.food_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  image_reference text,
  food_name text NOT NULL,
  ai_estimated_quantity integer,
  confirmed_quantity integer,
  quantity_unit text NOT NULL DEFAULT 'portions',
  ai_estimated_weight numeric,
  quality_screening_status text NOT NULL,
  assessment_note text,
  confirmation_status text NOT NULL DEFAULT 'awaiting_confirmation',
  analysis_mode text NOT NULL DEFAULT 'live_ai',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
GRANT ALL ON public.food_assessments TO service_role;
ALTER TABLE public.food_assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.surplus_food (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  assessment_id uuid UNIQUE REFERENCES public.food_assessments(id) ON DELETE SET NULL,
  food_name text NOT NULL,
  quantity integer NOT NULL,
  unit text NOT NULL DEFAULT 'portions',
  estimated_weight_kg numeric,
  state text NOT NULL DEFAULT 'ASSESSMENT_COMPLETE',
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.surplus_food TO service_role;
ALTER TABLE public.surplus_food ENABLE ROW LEVEL SECURITY;

INSERT INTO public.kitchens (name, contact_name, phone, address, status) VALUES
('Harvest Community Kitchen','Meera Nair','+919845011220','12 MG Road, Bengaluru','approved'),
('St. Anne''s Hospital Canteen','Joseph D''Souza','+919886144310','Richmond Town, Bengaluru','approved'),
('TechPark Cafeteria B','Arjun Rao','+919900187654','Whitefield, Bengaluru','approved');