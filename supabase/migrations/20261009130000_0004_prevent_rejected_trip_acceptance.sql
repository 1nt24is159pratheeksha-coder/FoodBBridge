-- A driver who rejected an offer must not be able to accept it through a
-- retried or manually forged server-function request.
CREATE OR REPLACE FUNCTION public.driver_accept_trip(p_allocation_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_status text;
BEGIN
  PERFORM 1 FROM public.drivers WHERE id = p_driver_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Driver is not approved'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.driver_trip_responses
    WHERE allocation_id = p_allocation_id AND driver_id = p_driver_id AND response = 'Rejected'
  ) THEN
    RAISE EXCEPTION 'You already rejected this trip';
  END IF;
  IF EXISTS (SELECT 1 FROM public.allocations WHERE driver_id = p_driver_id AND delivery_status <> 'Delivered') THEN
    RAISE EXCEPTION 'Driver already has an active trip';
  END IF;
  SELECT delivery_status INTO current_status FROM public.allocations
    WHERE id = p_allocation_id AND status = 'ACCEPTED' FOR UPDATE;
  IF current_status IS DISTINCT FROM 'Awaiting driver assignment' THEN
    RAISE EXCEPTION 'Trip is no longer available';
  END IF;
  UPDATE public.allocations SET driver_id = p_driver_id, delivery_status = 'Driver Assigned', updated_at = now()
    WHERE id = p_allocation_id AND driver_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip was already assigned'; END IF;
  INSERT INTO public.driver_trip_events (allocation_id, driver_id, status) VALUES (p_allocation_id, p_driver_id, 'Accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.driver_accept_trip(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_accept_trip(uuid, uuid) TO service_role;
