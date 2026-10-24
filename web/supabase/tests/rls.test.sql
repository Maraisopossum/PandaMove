-- Test pgTAP d'isolation RLS (à lancer avec `supabase test db`).
begin;
select plan(7);

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

-- 0006 : plus aucun DELETE physique (suppression logique via deleted_at)
select throws_ok($$delete from seances$$, '42501', null, 'delete physique refusé (droit retiré par 0006)');

select throws_ok(
  $$insert into seances (id, user_id, nom, groupes_musculaires, duree_estimee_min, notes, seance_category, created_at, is_archived)
    values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'x', '', 1, '', 'STRENGTH', '2026-01-01', false)$$,
  '42501', null, 'B ne peut pas insérer avec le user_id de A');

-- A voit toujours sa ligne intacte
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select is((select nom from seances), 'Push', 'la ligne de A est intacte');

-- 0006 : le rôle anon (non connecté) n'a aucun droit
reset role;
set local role anon;
select throws_ok($$select * from seances$$, '42501', null, 'anon ne peut pas lire les séances');
select throws_ok(
  $$insert into seances (id, nom, groupes_musculaires, duree_estimee_min, notes, seance_category, created_at, is_archived)
    values ('10000000-0000-4000-8000-000000000003', 'x', '', 1, '', 'STRENGTH', '2026-01-01', false)$$,
  '42501', null, 'anon ne peut pas insérer');

select * from finish();
rollback;
