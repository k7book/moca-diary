-- 초대 코드 생성 오류 수정 패치 (gen_random_bytes 의존 제거)
-- Supabase SQL Editor 에 붙여넣고 Run 하세요.

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

grant execute on function create_family(text, text, jsonb) to authenticated;
