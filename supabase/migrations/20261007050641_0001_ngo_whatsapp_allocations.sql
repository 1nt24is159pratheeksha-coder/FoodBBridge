CREATE TABLE public.ngos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  phone text NOT NULL UNIQUE,
  address text,
  distance_km numeric,
  status text NOT NULL DEFAULT 'approved',
  conversation_state text NOT NULL DEFAULT 'idle',
  pending_surplus_id uuid REFERENCES public.surplus_food(id) ON DELETE SET NULL,
  proposed_quantity integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ngos TO service_role;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surplus_id uuid NOT NULL REFERENCES public.surplus_food(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  delivery_status text,
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.allocations TO service_role;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.surplus_food ADD COLUMN usable_until timestamptz;
ALTER TABLE public.surplus_food ADD COLUMN pickup_location text;
UPDATE public.surplus_food SET usable_until = now() + interval '4 hours' WHERE usable_until IS NULL;

ALTER TABLE public.whatsapp_messages ADD COLUMN ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL;

INSERT INTO public.ngos (name, contact_name, phone, address, distance_km)
VALUES ('Sunrise Shelter', 'Demo NGO contact', '+919900011122', 'Indiranagar, Bengaluru', 2);