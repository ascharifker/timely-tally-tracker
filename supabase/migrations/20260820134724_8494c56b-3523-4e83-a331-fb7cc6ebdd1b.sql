REVOKE ALL ON FUNCTION public.current_user_can_edit_qc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_qc() TO authenticated, service_role;