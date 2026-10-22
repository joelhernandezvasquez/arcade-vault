-- Spec 14: autenticación con Supabase Auth, perfiles con alias y puntajes con dueño.

-- Perfiles: un alias único por cuenta, visible en el salón.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique check (alias ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Solo lectura desde el cliente; el insert lo hace el trigger.
create policy "profiles_select_public" on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Crea el perfil desde user_metadata.alias al registrarse.
-- Si el alias ya existe, el unique falla y el registro entero se cancela.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'alias' is not null then
    insert into public.profiles (id, alias)
    values (new.id, upper(new.raw_user_meta_data ->> 'alias'));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprobación previa al registro (la tabla no expone nada más que el alias).
create function public.alias_disponible(p_alias text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where alias = upper(p_alias)
  );
$$;

revoke execute on function public.alias_disponible(text) from public;
grant execute on function public.alias_disponible(text) to anon, authenticated;

-- El trigger no debe poder invocarse desde la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Puntajes con dueño. Las filas antiguas quedan con user_id = null.
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own" on public.scores
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and name = (select alias from public.profiles where id = auth.uid())
  );

-- Con sesión las peticiones van como `authenticated`: ampliar los select.
drop policy "games_select_public" on public.games;
create policy "games_select_public" on public.games
  for select
  to anon, authenticated
  using (true);

drop policy "scores_select_public" on public.scores;
create policy "scores_select_public" on public.scores
  for select
  to anon, authenticated
  using (true);
