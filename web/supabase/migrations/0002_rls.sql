-- RLS : chaque utilisateur n'accède qu'à ses propres lignes.

alter table exercises enable row level security;
create policy exercises_proprietaire on exercises
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table seances enable row level security;
create policy seances_proprietaire on seances
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table blocs_seance enable row level security;
create policy blocs_seance_proprietaire on blocs_seance
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table exercices_seance enable row level security;
create policy exercices_seance_proprietaire on exercices_seance
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table instances_seance enable row level security;
create policy instances_seance_proprietaire on instances_seance
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table series_realisees enable row level security;
create policy series_realisees_proprietaire on series_realisees
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table objectifs_progression enable row level security;
create policy objectifs_progression_proprietaire on objectifs_progression
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table user_settings enable row level security;
create policy user_settings_proprietaire on user_settings
  using (user_id = auth.uid()) with check (user_id = auth.uid());
