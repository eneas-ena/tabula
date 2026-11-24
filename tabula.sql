-- =====================================================================
-- TÁBULA — banco no projeto principal (quiz-biblico), schema próprio "tabula"
-- Rode tudo de uma vez no SQL Editor do Supabase.
-- Depois: Project Settings → Data API → Exposed schemas → acrescente  tabula
-- =====================================================================
create schema if not exists tabula;

-- quem usa a Tábula e se está autorizado
create table if not exists tabula.usuarios (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  aprovado   boolean not null default false,
  admin      boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- as cenas (cada quadro)
create table if not exists tabula.cenas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo         text not null default 'Sem título',
  dados          jsonb not null default '{}'::jsonb,
  miniatura      text,
  apagado        boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists cenas_user_idx on tabula.cenas (user_id, atualizado_em desc);

-- biblioteca pessoal (formas salvas para reutilizar)
create table if not exists tabula.biblioteca (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  itens          jsonb not null default '[]'::jsonb,
  atualizado_em  timestamptz not null default now()
);

-- ---------- funções de apoio ----------
create or replace function tabula.eh_aprovado() returns boolean
language sql stable security definer set search_path = tabula, public as $$
  select exists (select 1 from tabula.usuarios where user_id = auth.uid() and aprovado);
$$;

create or replace function tabula.eh_admin() returns boolean
language sql stable security definer set search_path = tabula, public as $$
  select exists (select 1 from tabula.usuarios where user_id = auth.uid() and admin);
$$;

-- chamado pelo app a cada entrada: registra a pessoa; o PRIMEIRO a entrar vira administrador
create or replace function tabula.registrar() returns tabula.usuarios
language plpgsql security definer set search_path = tabula, public as $$
declare r tabula.usuarios; v_email text; v_nome text;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  select u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1))
    into v_email, v_nome from auth.users u where u.id = auth.uid();
  insert into tabula.usuarios (user_id, email, nome) values (auth.uid(), v_email, v_nome)
    on conflict (user_id) do update set email = excluded.email;
  if not exists (select 1 from tabula.usuarios where admin) then
    update tabula.usuarios set admin = true, aprovado = true where user_id = auth.uid();
  end if;
  select * into r from tabula.usuarios where user_id = auth.uid();
  return r;
end $$;

-- só o administrador autoriza ou revoga
create or replace function tabula.definir_aprovado(p_user uuid, p_aprovado boolean) returns void
language plpgsql security definer set search_path = tabula, public as $$
begin
  if not tabula.eh_admin() then raise exception 'apenas o administrador'; end if;
  if p_user = auth.uid() then raise exception 'não é possível mudar o próprio acesso'; end if;
  update tabula.usuarios set aprovado = p_aprovado where user_id = p_user;
end $$;

-- ---------- segurança (RLS) ----------
alter table tabula.usuarios   enable row level security;
alter table tabula.cenas      enable row level security;
alter table tabula.biblioteca enable row level security;

drop policy if exists usuarios_ler on tabula.usuarios;
create policy usuarios_ler on tabula.usuarios for select
  using (user_id = auth.uid() or tabula.eh_admin());

drop policy if exists cenas_dono on tabula.cenas;
create policy cenas_dono on tabula.cenas for all
  using (user_id = auth.uid() and tabula.eh_aprovado())
  with check (user_id = auth.uid() and tabula.eh_aprovado());

drop policy if exists biblioteca_dono on tabula.biblioteca;
create policy biblioteca_dono on tabula.biblioteca for all
  using (user_id = auth.uid() and tabula.eh_aprovado())
  with check (user_id = auth.uid() and tabula.eh_aprovado());

-- ---------- permissões (GRANT explícito, exigido desde 30/10/2026) ----------
grant usage on schema tabula to anon, authenticated, service_role;
grant all on all tables in schema tabula to anon, authenticated, service_role;
grant all on all sequences in schema tabula to anon, authenticated, service_role;
grant execute on all functions in schema tabula to anon, authenticated, service_role;
alter default privileges in schema tabula grant all on tables to anon, authenticated, service_role;
alter default privileges in schema tabula grant execute on functions to anon, authenticated, service_role;
