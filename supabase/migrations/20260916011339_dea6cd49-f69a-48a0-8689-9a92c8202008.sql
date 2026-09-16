REVOKE EXECUTE ON FUNCTION public.bulk_import_maquinados(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_import_maquinados(jsonb) TO authenticated, service_role;