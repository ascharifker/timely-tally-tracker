CREATE OR REPLACE FUNCTION public.current_user_can_edit_po(_po_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _track public.review_track;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    return false;
  end if;
  if public.has_role(_uid, 'admin') or public.has_role(_uid, 'po_editor') or public.has_role(_uid, 'engineer') then
    return true;
  end if;
  select review_track into _track from public.purchase_orders where id = _po_id;
  if _track is null then
    return false;
  end if;
  if _track = 'coe' and public.has_role(_uid, 'coe_reviewer') then
    return true;
  end if;
  if _track = 'third_party' and public.has_role(_uid, 'third_party_reviewer') then
    return true;
  end if;
  if public.has_active_delegation(_uid, _track) then
    return true;
  end if;
  return false;
end;
$function$;