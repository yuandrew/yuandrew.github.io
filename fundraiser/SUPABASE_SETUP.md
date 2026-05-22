# Fundraiser Supabase Setup

Run this SQL in your Supabase project's SQL Editor. It creates a private signup table and a public view that never exposes donor emails.

```sql
create table if not exists public.fundraiser_donors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  anonymous boolean not null default false,
  donation_type text not null check (donation_type in ('total', 'per_unit')),
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('venmo', 'self_donate')),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table public.fundraiser_donors enable row level security;

drop policy if exists "Anyone can submit fundraiser pledges" on public.fundraiser_donors;
create policy "Anyone can submit fundraiser pledges"
on public.fundraiser_donors
for insert
to anon
with check (true);

drop view if exists public.fundraiser_public_donors;
create view public.fundraiser_public_donors as
select
  id,
  created_at,
  case
    when anonymous then 'Anonymous'
    else name
  end as display_name,
  donation_type,
  amount,
  payment_method
from public.fundraiser_donors
order by created_at desc;

revoke all on public.fundraiser_donors from anon;
grant insert on public.fundraiser_donors to anon;
grant select on public.fundraiser_public_donors to anon;
```

After running the SQL:

1. Confirm `js/supabase-config.js` points at the Supabase project you want to use.
2. Visit `/fundraiser/` and submit a test pledge.
3. Visit `/fundraiser/donor-list/` and confirm the pledge appears.
4. In Supabase, use Table Editor or SQL to read `fundraiser_donors` when you need the private email list.

To export emails later:

```sql
select name, email, donation_type, amount, payment_method, created_at
from public.fundraiser_donors
order by created_at asc;
```

If you want to review pledges before they appear publicly, add an `approved boolean not null default false` column to `fundraiser_donors`, then add `where approved = true` to the public view.
