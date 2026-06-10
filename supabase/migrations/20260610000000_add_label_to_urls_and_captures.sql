alter table public.urls
  add column if not exists label text;

alter table public.captures
  add column if not exists label text;

create index if not exists idx_urls_label on public.urls (label);
create index if not exists idx_captures_label on public.captures (label);
