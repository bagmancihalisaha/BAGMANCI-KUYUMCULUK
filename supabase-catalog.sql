-- Run once in Supabase SQL Editor before publishing the catalog editor.
begin;
alter table public.products add column if not exists sub_category text not null default '';
alter table public.products add column if not exists order_no integer not null default 0;
create index if not exists products_catalog_order_idx on public.products (order_no, created_at desc);
notify pgrst, 'reload schema';
commit;
