-- Test pgTAP d'isolation RLS (à lancer avec `supabase test db`).
begin;
select plan(5);

-- Deux utilisateurs (auth.users est fourni par Supabase)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- A insère une séance
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
insert into seances (id, nom, groupes_musculaires, duree_estimee_min, notes, seance_category, created_at, is_archived)
values ('10000000-0000-4000-8000-000000000001', 'Push', 'PECTORAUX', 45, '', 'STRENGTH', '2026-01-01', false);

-- B ne voit rien et ne peut rien modifier
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);

select is((select count(*) from seances), 0::bigint, 'B ne voit aucune séance de A');

with u as (update seances set nom = 'piraté' returning 1)
select is((select count(*) from u), 0::bigint, 'update de B sur la ligne de A : 0 ligne');

with d as (delete from seances returning 1)
select is((select count(*) from d), 0::bigint, 'delete de B sur la ligne de A : 0 ligne');

select throws_ok(
  $$insert into seances (id, user_id, nom, groupes_musculaires, duree_estimee_min, notes, seance_category, created_at, is_archived)
    values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'x', '', 1, '', 'STRENGTH', '2026-01-01', false)$$,
  '42501', null, 'B ne peut pas insérer avec le user_id de A');

-- A voit toujours sa ligne intacte
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select is((select nom from seances), 'Push', 'la ligne de A est intacte');

select * from finish();
rollback;
