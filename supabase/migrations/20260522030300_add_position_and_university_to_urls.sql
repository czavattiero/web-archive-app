alter table public.urls
  add column if not exists position_title text,
  add column if not exists university_name text;
