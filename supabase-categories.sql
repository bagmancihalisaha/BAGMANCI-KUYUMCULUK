-- Requires supabase-media.sql and supabase-catalog.sql. Run in SQL Editor.
begin;
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cover_image text not null default '',
  sub_categories text[] not null default '{}',
  order_no integer not null default 0,
  is_active boolean not null default true
);
alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
drop policy if exists "Public active categories" on public.categories;
create policy "Public active categories" on public.categories for select to anon, authenticated using (is_active);
drop policy if exists "Admin categories" on public.categories;
create policy "Admin categories" on public.categories for all to authenticated
using (public.can_manage_media()) with check (public.can_manage_media());
insert into public.categories(name, slug, order_no) values
('Yüzük','yuzuk',1),('Küpe','kupe',2),('Bilezik','bilezik',3),('Bileklik','bileklik',4),
('Kolye','kolye',5),('Madonna','madonna',6),('Frenk Bağı','frenk-bagi',7),
('Urfa Akıtması','urfa-akitmasi',8),('Saat','saat',9),('Aksesuar','aksesuar',10)
on conflict do nothing;
update public.products set category = 'Saat' where category = 'Saat & Aksesuar';
insert into public.categories(name, slug, order_no)
select distinct trim(category), 'kategori-' || md5(trim(category)), 100 from public.products
where nullif(trim(category), '') is not null on conflict do nothing;
update public.categories c set cover_image = a.url from public.site_assets a
where a.key = 'catalog:' || c.name and c.cover_image = '';
update public.categories c set sub_categories = array(
  select distinct trim(p.sub_category) from public.products p
  where p.category = c.name and nullif(trim(p.sub_category), '') is not null
) where cardinality(c.sub_categories) = 0;
create or replace function public.sync_category_products() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if exists(select 1 from public.products where category = old.name) then
      raise exception 'Bu kategoride ürün var. Önce ürünleri taşıyın veya kategoriyi pasife alın.';
    end if;
    return old;
  end if;
  if old.name is distinct from new.name then
    update public.products set category = new.name where category = old.name;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_category_products on public.categories;
create trigger sync_category_products before update or delete on public.categories
for each row execute function public.sync_category_products();
create index if not exists categories_order_idx on public.categories(order_no, name);
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories') then
    alter publication supabase_realtime add table public.categories;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
