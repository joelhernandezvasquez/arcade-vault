-- SPEC 16: alias_disponible deja de ser SECURITY DEFINER.
-- Solo lee profiles, que ya tiene select público por RLS (profiles_select_public),
-- así que no necesita privilegios elevados.
create or replace function public.alias_disponible(p_alias text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where alias = upper(p_alias)
  );
$$;

revoke execute on function public.alias_disponible(text) from public;
grant execute on function public.alias_disponible(text) to anon, authenticated;
