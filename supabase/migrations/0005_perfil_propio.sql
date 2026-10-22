-- Spec 15: un jugador que entra con OAuth crea su propio perfil (alias) desde /auth/alias.

-- Solo puede insertar la fila con su propio id; el alias sigue siendo único y con formato validado.
create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
