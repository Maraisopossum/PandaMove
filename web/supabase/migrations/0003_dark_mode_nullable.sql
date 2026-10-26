-- dark_mode devient tri-état : null = aucun choix explicite (l'appli suit la préférence du système).
-- Sans cela, la première écriture de réglages (matériel, variante, import) figerait « clair ».
alter table user_settings alter column dark_mode drop not null;
alter table user_settings alter column dark_mode drop default;
