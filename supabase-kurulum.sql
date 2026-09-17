-- Bagmanci Kuyumculuk urun katalog kurulumu
-- Supabase > SQL Editor ekraninda bu dosyanin tamamini calistir.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  sku text,
  badge text,
  price_mode text not null default 'fixed' check (price_mode in ('fixed', 'liveGram')),
  gram numeric,
  labor numeric default 0,
  fixed_price numeric,
  images text[] default '{}',
  short_description text,
  description text,
  material text,
  ayar text,
  renk text,
  tas text,
  olcu text,
  stok text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products add column if not exists labor_type text not null default 'type1';
update public.products set labor_type = case when labor_type = 'money' then 'type2' else 'type1' end where labor_type in ('gram', 'money');
alter table public.products drop constraint if exists products_labor_type_check;
alter table public.products add constraint products_labor_type_check check (labor_type in ('type1', 'type2', 'type3'));

alter table public.products enable row level security;

-- Herkes aktif urunleri okuyabilir.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
to anon, authenticated
using (active = true);

-- Giris yapan admin urun ekleyebilir/duzenleyebilir/silebilir.
-- Supabase Auth'ta sadece kendi mailinle kullanacagin icin yeterli.
drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
on public.products for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
on public.products for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
on public.products for delete
to authenticated
using (true);

insert into public.products (
  id, name, category, sku, badge, price_mode, gram, labor, labor_type, fixed_price, images,
  short_description, description, material, ayar, renk, tas, olcu, stok
) values
('22-ayar-klasik-bilezik-01', '22 Ayar Klasik Bilezik', 'Bilezik', 'BGM-BLZ-001', '22 AYAR', 'liveGram', 18.5, 0, 'type1', null, array['products/bilezik-01.jpg'], 'Günlük kullanıma uygun 22 ayar bilezik modeli.', 'Fiyat canlı 22 ayar bilezik satış kuru üzerinden gram bazlı hesaplanır.', 'Altın', '22 Ayar', 'Sarı Altın', null, null, 'Mağazadan teyit'),
('urfa-akitmasi-model-01', 'Urfa Akıtması Modeli', 'Urfa Akıtması', 'BGM-URF-001', 'YÖRESEL', 'liveGram', 32, 0, 'type1', null, array['products/urfa-akitmasi-01.jpg'], 'Şanlıurfa yöresel takı geleneğinden ilham alan akıtma modeli.', 'Gram bilgisi ve canlı kurla fiyatlandırma müşteriye şeffaf şekilde gösterilir.', 'Altın', '22 Ayar', 'Sarı Altın', null, null, 'Mağazadan teyit'),
('tek-tas-yuzuk-01', 'Tek Taş Yüzük', 'Yüzük', 'BGM-YZK-001', 'ÖZEL', 'fixed', null, 0, 'type1', 26800, array['products/yuzuk-01.jpg'], 'Zarif taş görünümüyle özel günler için seçkin model.', 'Taş ölçü ve özel sipariş bilgileri mağaza iletişimiyle netleştirilebilir.', 'Altın', null, null, 'Tek taş', 'Mağazada ayarlanır', 'Mağazadan teyit'),
('klasik-erkek-saati-01', 'Klasik Erkek Saati', 'Saat & Aksesuar', 'BGM-SAT-001', 'SAAT', 'fixed', null, 0, 'type1', 4250, array['products/saat-01.jpg'], 'Günlük şıklık için garantili klasik erkek saati.', 'Stok ve renk seçenekleri için mağaza ile iletişime geçilebilir.', 'Saat', null, null, null, null, 'Mağazadan teyit')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');

-- Musteri sorulari ve duyurular
create table if not exists public.customer_questions (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  question text not null,
  answer text,
  status text not null default 'new' check (status in ('new', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table public.customer_questions enable row level security;

drop policy if exists "Public can send customer questions" on public.customer_questions;
create policy "Public can send customer questions"
on public.customer_questions for insert
to anon, authenticated
with check (char_length(question) between 2 and 2000);

drop policy if exists "Authenticated users can read customer questions" on public.customer_questions;
create policy "Authenticated users can read customer questions"
on public.customer_questions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can update customer questions" on public.customer_questions;
create policy "Authenticated users can update customer questions"
on public.customer_questions for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete customer questions" on public.customer_questions;
create policy "Authenticated users can delete customer questions"
on public.customer_questions for delete
to authenticated
using (true);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "Public can read active announcements" on public.announcements;
create policy "Public can read active announcements"
on public.announcements for select
to anon, authenticated
using (active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert announcements" on public.announcements;
create policy "Authenticated users can insert announcements"
on public.announcements for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update announcements" on public.announcements;
create policy "Authenticated users can update announcements"
on public.announcements for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete announcements" on public.announcements;
create policy "Authenticated users can delete announcements"
on public.announcements for delete
to authenticated
using (true);

-- Havale / EFT siparisleri
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  city text,
  district text,
  invoice_name text not null,
  invoice_identity_no text,
  tax_office text,
  corporate_invoice boolean not null default false,
  invoice_address_different boolean not null default false,
  invoice_address text not null,
  shipping_address text not null,
  note text,
  payment_method text not null default 'havale_eft',
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null default 'new' check (status in ('new', 'payment_waiting', 'paid', 'preparing', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders add column if not exists invoice_identity_no text;
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists district text;
alter table public.orders add column if not exists tax_office text;
alter table public.orders add column if not exists corporate_invoice boolean not null default false;
alter table public.orders add column if not exists invoice_address_different boolean not null default false;
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;

alter table public.orders enable row level security;

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
on public.orders for insert
to anon, authenticated
with check (char_length(customer_name) > 1 and char_length(phone) > 5 and char_length(coalesce(email, '')) > 3 and jsonb_array_length(items) > 0);

drop policy if exists "Authenticated users can read orders" on public.orders;
create policy "Authenticated users can read orders"
on public.orders for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
on public.orders for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Authenticated users can update orders" on public.orders;
create policy "Authenticated users can update orders"
on public.orders for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete orders" on public.orders;
create policy "Authenticated users can delete orders"
on public.orders for delete
to authenticated
using (true);
-- 2FA ADMIN GUVENLIK KILIDI
-- Admin islemleri icin Supabase Auth MFA seviyesinin aal2 olmasini zorunlu tutar.
-- Yani sadece sifre yetmez; telefondaki 6 haneli kod dogrulanmadan yonetim yetkisi acilmaz.

drop policy if exists "MFA admins can read all products" on public.products;
create policy "MFA admins can read all products"
on public.products for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
on public.products for insert
to authenticated
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
on public.products for update
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2')
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
on public.products for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and (auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and (auth.jwt() ->> 'aal') = 'aal2')
with check (bucket_id = 'product-images' and (auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and (auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can read customer questions" on public.customer_questions;
create policy "Authenticated users can read customer questions"
on public.customer_questions for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can update customer questions" on public.customer_questions;
create policy "Authenticated users can update customer questions"
on public.customer_questions for update
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2')
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can delete customer questions" on public.customer_questions;
create policy "Authenticated users can delete customer questions"
on public.customer_questions for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Public can read active announcements" on public.announcements;
create policy "Public can read active announcements"
on public.announcements for select
to anon, authenticated
using (active = true or ((auth.jwt() ->> 'aal') = 'aal2'));

drop policy if exists "Authenticated users can insert announcements" on public.announcements;
create policy "Authenticated users can insert announcements"
on public.announcements for insert
to authenticated
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can update announcements" on public.announcements;
create policy "Authenticated users can update announcements"
on public.announcements for update
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2')
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can delete announcements" on public.announcements;
create policy "Authenticated users can delete announcements"
on public.announcements for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can read orders" on public.orders;
create policy "Authenticated users can read orders"
on public.orders for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can update orders" on public.orders;
create policy "Authenticated users can update orders"
on public.orders for update
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2')
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Authenticated users can delete orders" on public.orders;
create policy "Authenticated users can delete orders"
on public.orders for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');
-- ADMIN GIRIS HAREKETLERI
create table if not exists public.admin_security_events (
  id uuid primary key default gen_random_uuid(),
  email text,
  event_type text not null default 'login' check (event_type in ('login', 'logout', 'password_change')),
  ip text,
  city text,
  country text,
  device text,
  browser text,
  os text,
  user_agent text,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admin_security_events enable row level security;

drop policy if exists "MFA admins can insert security events" on public.admin_security_events;
create policy "MFA admins can insert security events"
on public.admin_security_events for insert
to authenticated
with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "MFA admins can read security events" on public.admin_security_events;
create policy "MFA admins can read security events"
on public.admin_security_events for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "MFA admins can delete security events" on public.admin_security_events;
create policy "MFA admins can delete security events"
on public.admin_security_events for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');
-- MUSTERI UYELIK PROFILLERI
-- Musteri e-posta/telefon dogrulamasindan sonra profil bilgileri burada tutulur.
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  ring_size text,
  bracelet_size text,
  default_address text,
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers can insert own profile" on public.customer_profiles;
create policy "Customers can insert own profile"
on public.customer_profiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Customers can read own profile" on public.customer_profiles;
create policy "Customers can read own profile"
on public.customer_profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Customers can update own profile" on public.customer_profiles;
create policy "Customers can update own profile"
on public.customer_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "MFA admins can read customer profiles" on public.customer_profiles;
create policy "MFA admins can read customer profiles"
on public.customer_profiles for select
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "MFA admins can delete customer profiles" on public.customer_profiles;
create policy "MFA admins can delete customer profiles"
on public.customer_profiles for delete
to authenticated
using ((auth.jwt() ->> 'aal') = 'aal2');

alter table public.customer_questions add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.customer_questions add column if not exists email text;
alter table public.customer_questions add column if not exists product_id text;
alter table public.customer_questions add column if not exists product_name text;

drop policy if exists "Public can send customer questions" on public.customer_questions;
drop policy if exists "Customers can send own customer questions" on public.customer_questions;
create policy "Customers can send own customer questions"
on public.customer_questions for insert
to authenticated
with check (auth.uid() = customer_id and char_length(question) between 2 and 2000);

drop policy if exists "Customers can read own customer questions" on public.customer_questions;
create policy "Customers can read own customer questions"
on public.customer_questions for select
to authenticated
using (auth.uid() = customer_id);
