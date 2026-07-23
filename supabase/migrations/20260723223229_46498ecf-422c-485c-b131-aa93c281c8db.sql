
CREATE TABLE public.site_stats (
  name text PRIMARY KEY,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_stats TO anon, authenticated;
GRANT ALL ON public.site_stats TO service_role;

ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stats"
  ON public.site_stats FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.site_stats (name, count) VALUES ('canvas_clicks', 0);

CREATE OR REPLACE FUNCTION public.increment_stat(_name text, _by int DEFAULT 1)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  IF _by < 1 OR _by > 100 THEN
    _by := 1;
  END IF;
  INSERT INTO public.site_stats (name, count)
  VALUES (_name, _by)
  ON CONFLICT (name) DO UPDATE
    SET count = public.site_stats.count + _by,
        updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_stat(text, int) TO anon, authenticated;
