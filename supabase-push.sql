-- Run once in Supabase SQL Editor for Web Push subscriptions.
begin;
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  subscription jsonb,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_updated_idx on public.push_subscriptions (updated_at desc);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Public can register push subscriptions" on public.push_subscriptions;
create policy "Public can register push subscriptions"
on public.push_subscriptions for insert to anon, authenticated with check (true);
drop policy if exists "Public can refresh push subscriptions" on public.push_subscriptions;
create policy "Public can refresh push subscriptions"
on public.push_subscriptions for update to anon, authenticated using (true) with check (true);

create or replace function public.set_push_subscription_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();

notify pgrst, 'reload schema';
commit;
