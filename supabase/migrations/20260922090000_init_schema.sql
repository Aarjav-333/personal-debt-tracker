-- ===========================================================================
-- Personal Debt Tracker - initial schema
--
-- Design rules enforced here:
--   * Money is NUMERIC(14,2). Never float.
--   * The original borrowed amount is never mutated by a repayment. Repayments
--     live in their own table and outstanding balances are always derived.
--   * Every row is owned by a user and reachable only through Row Level
--     Security. Composite foreign keys make it impossible for a debt or
--     repayment to reference another user's rows.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  currency     text not null default 'INR',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_currency_supported
    check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED')),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80)
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- borrowers
-- ---------------------------------------------------------------------------

create table if not exists public.borrowers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  phone      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint borrowers_name_length
    check (char_length(btrim(name)) between 1 and 120),
  constraint borrowers_phone_length
    check (phone is null or char_length(btrim(phone)) between 4 and 24),
  constraint borrowers_notes_length
    check (notes is null or char_length(notes) <= 2000),
  -- Target for the composite foreign keys below. Guarantees a debt can only
  -- ever point at a borrower belonging to the same user.
  constraint borrowers_id_user_key unique (id, user_id)
);

-- One borrower per name, per user: re-lending to the same person adds a debt,
-- it does not create a duplicate borrower.
create unique index if not exists borrowers_user_name_key
  on public.borrowers (user_id, lower(btrim(name)));

create index if not exists borrowers_user_id_idx on public.borrowers (user_id);

drop trigger if exists borrowers_set_updated_at on public.borrowers;
create trigger borrowers_set_updated_at
  before update on public.borrowers
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- debts  (one row per borrowing occasion)
-- ---------------------------------------------------------------------------

create table if not exists public.debts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  borrower_id          uuid not null,
  original_amount      numeric(14,2) not null,
  reason               text,
  borrowed_date        date not null default current_date,
  expected_return_date date,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint debts_amount_positive
    check (original_amount > 0 and original_amount <= 999999999.99),
  constraint debts_return_after_borrow
    check (expected_return_date is null or expected_return_date >= borrowed_date),
  constraint debts_reason_length  check (reason is null or char_length(reason) <= 200),
  constraint debts_notes_length   check (notes  is null or char_length(notes)  <= 2000),
  constraint debts_borrower_fk foreign key (borrower_id, user_id)
    references public.borrowers (id, user_id) on delete cascade,
  constraint debts_id_user_key unique (id, user_id)
);

create index if not exists debts_user_id_idx       on public.debts (user_id);
create index if not exists debts_borrower_id_idx   on public.debts (borrower_id);
create index if not exists debts_user_expected_idx on public.debts (user_id, expected_return_date);
create index if not exists debts_user_borrowed_idx on public.debts (user_id, borrowed_date desc);

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- repayments  (one row per installment returned)
-- ---------------------------------------------------------------------------

create table if not exists public.repayments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  debt_id        uuid not null,
  borrower_id    uuid not null,
  amount         numeric(14,2) not null,
  repayment_date date not null default current_date,
  method         text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint repayments_amount_positive
    check (amount > 0 and amount <= 999999999.99),
  constraint repayments_method_length
    check (method is null or char_length(btrim(method)) <= 40),
  constraint repayments_notes_length
    check (notes is null or char_length(notes) <= 2000),
  constraint repayments_debt_fk foreign key (debt_id, user_id)
    references public.debts (id, user_id) on delete cascade,
  constraint repayments_borrower_fk foreign key (borrower_id, user_id)
    references public.borrowers (id, user_id) on delete cascade
);

create index if not exists repayments_user_id_idx     on public.repayments (user_id);
create index if not exists repayments_debt_id_idx     on public.repayments (debt_id);
create index if not exists repayments_borrower_id_idx on public.repayments (borrower_id);
create index if not exists repayments_user_date_idx   on public.repayments (user_id, repayment_date desc);

drop trigger if exists repayments_set_updated_at on public.repayments;
create trigger repayments_set_updated_at
  before update on public.repayments
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- A repayment's borrower is always the debt's borrower - it is derived, never
-- supplied by the client, so the two can never disagree.
-- Runs as the caller, so RLS hides debts belonging to anybody else and a
-- foreign debt_id is rejected as "not found" rather than leaking its existence.
create or replace function public.repayments_derive_parents()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_borrower_id uuid;
  v_user_id     uuid;
begin
  select d.borrower_id, d.user_id
    into v_borrower_id, v_user_id
    from public.debts d
   where d.id = new.debt_id;

  if v_borrower_id is null then
    raise exception 'Debt % was not found', new.debt_id
      using errcode = 'foreign_key_violation';
  end if;

  new.borrower_id := v_borrower_id;
  new.user_id     := v_user_id;
  return new;
end;
$$;

drop trigger if exists repayments_derive_parents_trg on public.repayments;
create trigger repayments_derive_parents_trg
  before insert or update of debt_id on public.repayments
  for each row execute function public.repayments_derive_parents();


-- Total repayments may never exceed the debt's original amount.
-- The debt row is locked first so two concurrent repayments cannot both read a
-- stale balance and each pass the check.
create or replace function public.repayments_enforce_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_original     numeric(14,2);
  v_other_repaid numeric(14,2);
begin
  select d.original_amount
    into v_original
    from public.debts d
   where d.id = new.debt_id
     for update;

  if v_original is null then
    raise exception 'Debt % was not found', new.debt_id
      using errcode = 'foreign_key_violation';
  end if;

  select coalesce(sum(r.amount), 0)
    into v_other_repaid
    from public.repayments r
   where r.debt_id = new.debt_id
     and (tg_op = 'INSERT' or r.id <> old.id);

  if v_other_repaid + new.amount > v_original then
    raise exception
      'Repayments would total % against an original debt of %',
      v_other_repaid + new.amount, v_original
      using errcode = 'check_violation',
            hint = 'Record a smaller repayment, or edit the original debt amount if it was entered incorrectly.';
  end if;

  return new;
end;
$$;

drop trigger if exists repayments_enforce_balance_trg on public.repayments;
create trigger repayments_enforce_balance_trg
  before insert or update of amount, debt_id on public.repayments
  for each row execute function public.repayments_enforce_balance();


-- Correcting a debt downwards must not strand repayments above the new total.
create or replace function public.debts_enforce_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_repaid numeric(14,2);
begin
  select coalesce(sum(r.amount), 0)
    into v_repaid
    from public.repayments r
   where r.debt_id = new.id;

  if new.original_amount < v_repaid then
    raise exception
      'Cannot lower this debt to % - % has already been repaid against it',
      new.original_amount, v_repaid
      using errcode = 'check_violation',
            hint = 'Edit or delete the repayments first.';
  end if;

  return new;
end;
$$;

drop trigger if exists debts_enforce_amount_trg on public.debts;
create trigger debts_enforce_amount_trg
  before update of original_amount on public.debts
  for each row execute function public.debts_enforce_amount();


-- ---------------------------------------------------------------------------
-- Derived balances
--
-- Nothing is denormalised: outstanding balances are computed from the
-- repayment rows every time they are read, so they can never drift.
-- security_invoker keeps Row Level Security on the underlying tables in force.
-- ---------------------------------------------------------------------------

create or replace view public.debt_balances
with (security_invoker = true) as
select
  d.id,
  d.user_id,
  d.borrower_id,
  b.name  as borrower_name,
  b.phone as borrower_phone,
  d.original_amount,
  d.reason,
  d.borrowed_date,
  d.expected_return_date,
  d.notes,
  d.created_at,
  d.updated_at,
  coalesce(r.total_repaid, 0)::numeric(14,2)                       as total_repaid,
  (d.original_amount - coalesce(r.total_repaid, 0))::numeric(14,2) as outstanding,
  coalesce(r.repayment_count, 0)::int                              as repayment_count,
  r.last_repayment_date
from public.debts d
join public.borrowers b on b.id = d.borrower_id
left join (
  select
    debt_id,
    sum(amount)         as total_repaid,
    count(*)            as repayment_count,
    max(repayment_date) as last_repayment_date
  from public.repayments
  group by debt_id
) r on r.debt_id = d.id;


create or replace view public.borrower_balances
with (security_invoker = true) as
select
  b.id,
  b.user_id,
  b.name,
  b.phone,
  b.notes,
  b.created_at,
  b.updated_at,
  coalesce(d.debt_count, 0)::int                                               as debt_count,
  coalesce(d.total_borrowed, 0)::numeric(14,2)                                 as total_borrowed,
  coalesce(r.total_repaid, 0)::numeric(14,2)                                   as total_repaid,
  (coalesce(d.total_borrowed, 0) - coalesce(r.total_repaid, 0))::numeric(14,2) as outstanding
from public.borrowers b
left join (
  select borrower_id, count(*) as debt_count, sum(original_amount) as total_borrowed
  from public.debts group by borrower_id
) d on d.borrower_id = b.id
left join (
  select borrower_id, sum(amount) as total_repaid
  from public.repayments group by borrower_id
) r on r.borrower_id = b.id;


-- Ledger-style feed: every borrowing and every repayment, newest first.
create or replace view public.activity_feed
with (security_invoker = true) as
select
  d.id                as id,
  'borrow'::text      as kind,
  d.user_id,
  d.borrower_id,
  b.name              as borrower_name,
  d.id                as debt_id,
  d.original_amount   as amount,
  d.borrowed_date     as event_date,
  d.reason            as detail,
  d.created_at
from public.debts d
join public.borrowers b on b.id = d.borrower_id
union all
select
  r.id,
  'repayment'::text,
  r.user_id,
  r.borrower_id,
  b.name,
  r.debt_id,
  r.amount,
  r.repayment_date,
  coalesce(nullif(btrim(r.method), ''), r.notes),
  r.created_at
from public.repayments r
join public.borrowers b on b.id = r.borrower_id;


-- ---------------------------------------------------------------------------
-- settle_debt: record the exact outstanding balance as one repayment.
--
-- "Mark fully paid" must leave a real money trail, not just flip a flag. The
-- debt is locked while the outstanding balance is measured and inserted so the
-- amount written is guaranteed to be the true remainder.
-- ---------------------------------------------------------------------------

create or replace function public.settle_debt(
  p_debt_id        uuid,
  p_repayment_date date default null,
  p_method         text default null,
  p_notes          text default null
)
returns public.repayments
language plpgsql
set search_path = ''
as $$
declare
  v_debt        public.debts;
  v_repaid      numeric(14,2);
  v_outstanding numeric(14,2);
  v_row         public.repayments;
begin
  select * into v_debt from public.debts where id = p_debt_id for update;

  if v_debt.id is null then
    raise exception 'Debt was not found' using errcode = 'foreign_key_violation';
  end if;

  select coalesce(sum(amount), 0) into v_repaid
    from public.repayments where debt_id = p_debt_id;

  v_outstanding := v_debt.original_amount - v_repaid;

  if v_outstanding <= 0 then
    raise exception 'This debt is already fully repaid'
      using errcode = 'check_violation';
  end if;

  insert into public.repayments
    (user_id, debt_id, borrower_id, amount, repayment_date, method, notes)
  values
    (v_debt.user_id, p_debt_id, v_debt.borrower_id, v_outstanding,
     coalesce(p_repayment_date, current_date), p_method, p_notes)
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Every policy is scoped to the owning user. auth.uid() is wrapped in a
-- sub-select so Postgres evaluates it once per statement instead of per row.
-- ---------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.borrowers  enable row level security;
alter table public.debts      enable row level security;
alter table public.repayments enable row level security;

-- profiles: a user may read and edit only their own profile. Rows are created
-- by the on_auth_user_created trigger and removed by the auth.users cascade.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using ((select auth.uid()) = id)
           with check ((select auth.uid()) = id);

-- borrowers
drop policy if exists borrowers_select_own on public.borrowers;
create policy borrowers_select_own on public.borrowers
  for select using ((select auth.uid()) = user_id);

drop policy if exists borrowers_insert_own on public.borrowers;
create policy borrowers_insert_own on public.borrowers
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists borrowers_update_own on public.borrowers;
create policy borrowers_update_own on public.borrowers
  for update using ((select auth.uid()) = user_id)
           with check ((select auth.uid()) = user_id);

drop policy if exists borrowers_delete_own on public.borrowers;
create policy borrowers_delete_own on public.borrowers
  for delete using ((select auth.uid()) = user_id);

-- debts
drop policy if exists debts_select_own on public.debts;
create policy debts_select_own on public.debts
  for select using ((select auth.uid()) = user_id);

drop policy if exists debts_insert_own on public.debts;
create policy debts_insert_own on public.debts
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists debts_update_own on public.debts;
create policy debts_update_own on public.debts
  for update using ((select auth.uid()) = user_id)
           with check ((select auth.uid()) = user_id);

drop policy if exists debts_delete_own on public.debts;
create policy debts_delete_own on public.debts
  for delete using ((select auth.uid()) = user_id);

-- repayments
drop policy if exists repayments_select_own on public.repayments;
create policy repayments_select_own on public.repayments
  for select using ((select auth.uid()) = user_id);

drop policy if exists repayments_insert_own on public.repayments;
create policy repayments_insert_own on public.repayments
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists repayments_update_own on public.repayments;
create policy repayments_update_own on public.repayments
  for update using ((select auth.uid()) = user_id)
           with check ((select auth.uid()) = user_id);

drop policy if exists repayments_delete_own on public.repayments;
create policy repayments_delete_own on public.repayments
  for delete using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- Grants
--
-- Signed-out callers (the `anon` role) have no business touching financial
-- data at all. RLS already blocks them because auth.uid() is null; revoking
-- the grants as well means a policy mistake alone cannot expose anything.
-- ---------------------------------------------------------------------------

revoke all on public.profiles   from anon;
revoke all on public.borrowers  from anon;
revoke all on public.debts      from anon;
revoke all on public.repayments from anon;

grant select, insert, update         on public.profiles   to authenticated;
grant select, insert, update, delete on public.borrowers  to authenticated;
grant select, insert, update, delete on public.debts      to authenticated;
grant select, insert, update, delete on public.repayments to authenticated;

grant select on public.debt_balances     to authenticated;
grant select on public.borrower_balances to authenticated;
grant select on public.activity_feed     to authenticated;

revoke all on public.debt_balances     from anon;
revoke all on public.borrower_balances from anon;
revoke all on public.activity_feed     from anon;

revoke all    on function public.settle_debt(uuid, date, text, text) from public, anon;
grant execute on function public.settle_debt(uuid, date, text, text) to authenticated;
