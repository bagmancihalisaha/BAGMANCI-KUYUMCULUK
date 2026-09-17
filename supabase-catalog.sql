-- Run once in Supabase SQL Editor before publishing the catalog editor.
begin;
alter table public.products add column if not exists sub_category text not null default '';
alter table public.products add column if not exists order_no integer not null default 0;
alter table public.products add column if not exists labor_type text not null default 'type1';
update public.products set labor_type = case when labor_type = 'money' then 'type2' else 'type1' end where labor_type in ('gram', 'money');
alter table public.products drop constraint if exists products_labor_type_check;
alter table public.products add constraint products_labor_type_check check (labor_type in ('type1', 'type2', 'type3'));
create index if not exists products_catalog_order_idx on public.products (order_no, created_at desc);
notify pgrst, 'reload schema';
commit;
