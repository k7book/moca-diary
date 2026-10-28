-- 모카 키우기 일지 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 실행하세요.
-- 사전 준비: Authentication > Providers > Anonymous sign-ins 를 켜 두세요.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------
create table if not exists families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  nickname   text not null,
  role       text not null check (role in ('child','observer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists pets (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id) on delete cascade,
  name                text not null,
  species             text,
  morph               text,
  adopted_at          date not null,
  adopted_place       text,
  photo_url           text,
  age_months_estimate int,
  feed_interval_days  int not null default 2,
  created_at          timestamptz not null default now()
);

create table if not exists daily_logs (
  id                 uuid primary key default gen_random_uuid(),
  pet_id             uuid not null references pets(id) on delete cascade,
  member_id          uuid not null references members(id),
  log_date           date not null,
  fed                boolean,
  food_type          text,
  food_amount        text,
  eaten              text,
  misted_am          boolean default false,
  misted_pm          boolean default false,
  temp_level         text,
  humidity_level     text,
  temp_c             numeric(4,1),
  humidity_pct       int,
  defecated          boolean,
  shed_status        text,
  weight_g           numeric(5,1),
  weight_is_estimate boolean default false,
  mood               int,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (pet_id, log_date)
);

create table if not exists checklist_items (
  id       uuid primary key default gen_random_uuid(),
  pet_id   uuid not null references pets(id) on delete cascade,
  log_date date not null,
  item_key text not null,
  done     boolean not null default false,
  done_by  uuid references members(id),
  done_at  timestamptz,
  unique (pet_id, log_date, item_key)
);

create table if not exists supplies (
  id       uuid primary key default gen_random_uuid(),
  pet_id   uuid not null references pets(id) on delete cascade,
  item_key text not null,
  done     boolean not null default false,
  done_at  timestamptz,
  unique (pet_id, item_key)
);

create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  log_id       uuid not null references daily_logs(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references daily_logs(id) on delete cascade,
  member_id  uuid not null references members(id),
  type       text not null check (type in ('sticker','comment')),
  value      text not null,
  created_at timestamptz not null default now()
);

create table if not exists badges (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (member_id, badge_key)
);

-- ---------------------------------------------------------------
-- 헬퍼 함수: 현재 로그인한 사용자의 family_id / member_id
-- ---------------------------------------------------------------
create or replace function current_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from members where user_id = auth.uid() limit 1
$$;

create or replace function current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid() limit 1
$$;

create or replace function pet_family(p_pet uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from pets where id = p_pet
$$;

create or replace function log_family(p_log uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.family_id from daily_logs l join pets p on p.id = l.pet_id where l.id = p_log
$$;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table families        enable row level security;
alter table members         enable row level security;
alter table pets            enable row level security;
alter table daily_logs      enable row level security;
alter table checklist_items enable row level security;
alter table supplies        enable row level security;
alter table photos          enable row level security;
alter table reactions       enable row level security;
alter table badges          enable row level security;

drop policy if exists fam_select on families;
create policy fam_select on families for select using (id = current_family_id());

drop policy if exists mem_select on members;
create policy mem_select on members for select using (family_id = current_family_id());
drop policy if exists mem_admin on members;
create policy mem_admin on members for update using (
  family_id = current_family_id()
  and exists (select 1 from members m where m.user_id = auth.uid() and m.role = 'admin')
);
drop policy if exists mem_admin_del on members;
create policy mem_admin_del on members for delete using (
  family_id = current_family_id()
  and exists (select 1 from members m where m.user_id = auth.uid() and m.role = 'admin')
);

drop policy if exists pet_all on pets;
create policy pet_all on pets for all
  using (family_id = current_family_id()) with check (family_id = current_family_id());

drop policy if exists log_all on daily_logs;
create policy log_all on daily_logs for all
  using (pet_family(pet_id) = current_family_id()) with check (pet_family(pet_id) = current_family_id());

drop policy if exists chk_all on checklist_items;
create policy chk_all on checklist_items for all
  using (pet_family(pet_id) = current_family_id()) with check (pet_family(pet_id) = current_family_id());

drop policy if exists sup_all on supplies;
create policy sup_all on supplies for all
  using (pet_family(pet_id) = current_family_id()) with check (pet_family(pet_id) = current_family_id());

drop policy if exists photo_all on photos;
create policy photo_all on photos for all
  using (log_family(log_id) = current_family_id()) with check (log_family(log_id) = current_family_id());

drop policy if exists react_all on reactions;
create policy react_all on reactions for all
  using (log_family(log_id) = current_family_id()) with check (log_family(log_id) = current_family_id());

drop policy if exists badge_all on badges;
create policy badge_all on badges for all
  using (exists (select 1 from members m where m.id = badges.member_id and m.family_id = current_family_id()))
  with check (exists (select 1 from members m where m.id = badges.member_id and m.family_id = current_family_id()));

-- ---------------------------------------------------------------
-- RPC: 가족 만들기 / 초대 코드로 합류
-- (security definer: RLS를 우회해 초대 코드로 가족을 찾는다)
-- ---------------------------------------------------------------
create or replace function create_family(
  p_family_name text, p_nickname text, p_pet jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_family uuid;
  v_member uuid;
  v_pet uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already a member';
  end if;
  -- 6자리 코드, 헷갈리는 글자 제외
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from families where invite_code = v_code);
  end loop;
  insert into families(name, invite_code) values (p_family_name, v_code) returning id into v_family;
  insert into members(family_id, user_id, nickname, role) values (v_family, auth.uid(), p_nickname, 'admin') returning id into v_member;
  insert into pets(family_id, name, species, morph, adopted_at, adopted_place, age_months_estimate, feed_interval_days)
  values (
    v_family,
    coalesce(p_pet->>'name', '모카'),
    coalesce(p_pet->>'species', '크레스티드 게코'),
    coalesce(p_pet->>'morph', '릴리 화이트'),
    coalesce((p_pet->>'adopted_at')::date, current_date),
    p_pet->>'adopted_place',
    (p_pet->>'age_months_estimate')::int,
    coalesce((p_pet->>'feed_interval_days')::int, 2)
  ) returning id into v_pet;
  return jsonb_build_object('family_id', v_family, 'member_id', v_member, 'pet_id', v_pet, 'invite_code', v_code);
end $$;

create or replace function join_family(
  p_code text, p_nickname text, p_role text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid;
  v_member uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already a member';
  end if;
  select id into v_family from families where invite_code = upper(trim(p_code));
  if v_family is null then raise exception 'invalid code'; end if;
  if p_role not in ('child','observer') then p_role := 'observer'; end if;
  insert into members(family_id, user_id, nickname, role) values (v_family, auth.uid(), p_nickname, p_role) returning id into v_member;
  return jsonb_build_object('family_id', v_family, 'member_id', v_member);
end $$;

grant execute on function create_family(text, text, jsonb) to authenticated;
grant execute on function join_family(text, text, text) to authenticated;

-- updated_at 자동 갱신
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists daily_logs_touch on daily_logs;
create trigger daily_logs_touch before update on daily_logs for each row execute function touch_updated_at();

-- ---------------------------------------------------------------
-- Storage: Storage > New bucket 에서 'photos' (비공개) 버킷을 만든 뒤 아래 정책 실행
-- 경로 규칙: {family_id}/{log_id}/{timestamp}.jpg
-- ---------------------------------------------------------------
drop policy if exists photos_rw on storage.objects;
create policy photos_rw on storage.objects for all
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = current_family_id()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = current_family_id()::text);
