-- Dropbox integration config (server-only; holds OAuth refresh token)
CREATE TABLE public.dropbox_config (
  id boolean NOT NULL DEFAULT true PRIMARY KEY CHECK (id),
  refresh_token text,
  account_name text,
  account_email text,
  root_folder text NOT NULL DEFAULT '',
  connected_at timestamptz,
  connected_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-only table: no privileges for anon/authenticated. Reached solely via
-- privileged server functions.
GRANT ALL ON public.dropbox_config TO service_role;
ALTER TABLE public.dropbox_config ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_dropbox_config_updated_at
BEFORE UPDATE ON public.dropbox_config
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.dropbox_config (id) VALUES (true);

-- Attached design plan on a PO line
ALTER TABLE public.po_line_items
  ADD COLUMN plan_dropbox_path text,
  ADD COLUMN plan_dropbox_name text,
  ADD COLUMN plan_dropbox_rev text;