-- Peer-to-Peer Micro-Scholarship & Skill Mentorship Hub
-- Run in the Supabase SQL editor or as a database migration.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('student', 'donor', 'mentor');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.request_status as enum ('pending', 'active', 'funded', 'completed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'donor',
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private registration fields are separated from publicly readable profiles.
-- In particular, student NIC/ID values must never be exposed to other users.
create table if not exists public.private_registration_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  district text,
  institution text,
  field_of_study text,
  student_identifier text,
  country_city text,
  area_of_expertise text,
  organization text,
  created_at timestamptz not null default now(),
  constraint registration_fields_length check (
    (district is null or char_length(district) <= 100)
    and (institution is null or char_length(institution) <= 180)
    and (field_of_study is null or char_length(field_of_study) <= 160)
    and (student_identifier is null or char_length(student_identifier) <= 80)
    and (country_city is null or char_length(country_city) <= 120)
    and (area_of_expertise is null or char_length(area_of_expertise) <= 200)
    and (organization is null or char_length(organization) <= 180)
  )
);

create table if not exists public.student_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  district text not null check (char_length(btrim(district)) between 1 and 100),
  school_name text,
  education_level text,
  bio text check (bio is null or char_length(bio) <= 2000),
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_verification_consistency
    check ((is_verified and verified_at is not null) or (not is_verified and verified_at is null))
);

create table if not exists public.scholarship_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 160),
  description text not null check (char_length(btrim(description)) between 20 and 5000),
  category text not null check (category in ('books', 'exam_fee', 'internet_data', 'hardware', 'other')),
  target_amount_lkr bigint not null check (target_amount_lkr > 0),
  cost_breakdown text not null default '' check (char_length(cost_breakdown) <= 3000),
  deadline date not null,
  proof_document_path text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.scholarship_requests (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 3000),
  receipt_path text,
  is_completed boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.scholarship_requests
  add column if not exists cost_breakdown text not null default '';
alter table public.scholarship_requests
  drop constraint if exists scholarship_requests_cost_breakdown_check;
alter table public.scholarship_requests
  add constraint scholarship_requests_cost_breakdown_check
  check (char_length(cost_breakdown) <= 3000);
alter table public.scholarship_requests
  drop constraint if exists scholarship_requests_category_check;
alter table public.scholarship_requests
  add constraint scholarship_requests_category_check
  check (category in ('books', 'exam_fee', 'internet_data', 'hardware', 'other'));
alter table public.milestones
  add column if not exists is_completed boolean not null default false;
alter table public.milestones
  add column if not exists is_verified boolean not null default false;

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.scholarship_requests (id) on delete cascade,
  donor_id uuid references public.users (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('LKR', 'USD', 'GBP', 'AUD')),
  amount_lkr bigint not null check (amount_lkr > 0),
  payment_provider text not null check (payment_provider in ('payhere', 'stripe')),
  provider_reference text unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.mentorship_slots (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booked_by uuid references public.users (id) on delete set null,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mentorship_slots_valid_time check (ends_at > starts_at),
  constraint mentorship_slots_booking_consistency
    check ((booked_by is null and booked_at is null) or (booked_by is not null and booked_at is not null))
);

create table if not exists public.mentor_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 5 and 160),
  bio text not null check (char_length(btrim(bio)) between 20 and 3000),
  expertise text[] not null default '{}',
  organization text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scholarship_requests_student_id_idx
  on public.scholarship_requests (student_id);
create index if not exists scholarship_requests_feed_idx
  on public.scholarship_requests (status, deadline);
create index if not exists milestones_request_id_created_at_idx
  on public.milestones (request_id, created_at desc);
create index if not exists donations_request_id_status_idx
  on public.donations (request_id, status);
create index if not exists donations_donor_id_idx
  on public.donations (donor_id);
create index if not exists mentorship_slots_mentor_start_idx
  on public.mentorship_slots (mentor_id, starts_at);
create index if not exists mentorship_slots_booked_by_idx
  on public.mentorship_slots (booked_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

drop trigger if exists scholarship_requests_set_updated_at on public.scholarship_requests;
create trigger scholarship_requests_set_updated_at
before update on public.scholarship_requests
for each row execute function public.set_updated_at();

drop trigger if exists mentor_profiles_set_updated_at on public.mentor_profiles;
create trigger mentor_profiles_set_updated_at
before update on public.mentor_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  selected_role public.user_role;
  selected_name text;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  selected_role := case
    when requested_role in ('student', 'donor', 'mentor')
      then requested_role::public.user_role
    else 'donor'::public.user_role
  end;
  selected_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'New user'
  );

  insert into public.users (id, role, full_name)
  values (new.id, selected_role, selected_name)
  on conflict (id) do nothing;

  insert into public.private_registration_profiles (
    user_id,
    district,
    institution,
    field_of_study,
    student_identifier,
    country_city,
    area_of_expertise,
    organization
  )
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'district'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'institution'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'field_of_study'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'student_identifier'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'country_city'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'area_of_expertise'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'organization'), '')
  )
  on conflict (user_id) do nothing;

  if selected_role = 'student'::public.user_role then
    insert into public.student_profiles (
      user_id,
      district,
      school_name,
      education_level
    )
    values (
      new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'district'), ''), 'Not provided'),
      nullif(btrim(new.raw_user_meta_data ->> 'institution'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'field_of_study'), '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.scholarship_requests enable row level security;
alter table public.milestones enable row level security;
alter table public.donations enable row level security;
alter table public.mentorship_slots enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.private_registration_profiles enable row level security;

-- Grant only the operations and columns needed by browser clients. Roles,
-- verification state, payment data, and booking state remain server-managed.
revoke insert, update on public.users from authenticated;
grant select on public.users to authenticated;
grant update (full_name, avatar_url) on public.users to authenticated;
grant select (id, full_name, avatar_url) on public.users to anon;

revoke insert, update on public.student_profiles from authenticated;
grant select on public.student_profiles to anon, authenticated;
grant insert (user_id, district, school_name, education_level, bio)
  on public.student_profiles to authenticated;
grant update (district, school_name, education_level, bio)
  on public.student_profiles to authenticated;

revoke insert, update on public.scholarship_requests from authenticated;
grant select on public.scholarship_requests to anon, authenticated;
grant insert (
  student_id, title, description, category, target_amount_lkr, cost_breakdown, deadline, proof_document_path
) on public.scholarship_requests to authenticated;
grant update (
  title, description, category, target_amount_lkr, cost_breakdown, deadline, proof_document_path
) on public.scholarship_requests to authenticated;

revoke insert on public.milestones from authenticated;
grant select on public.milestones to anon, authenticated;
grant insert (request_id, author_id, title, description, receipt_path)
  on public.milestones to authenticated;
grant update (title, description, receipt_path, is_completed)
  on public.milestones to authenticated;

revoke insert, update, delete on public.donations from anon, authenticated;
grant select on public.donations to authenticated;

revoke insert, update, delete on public.mentorship_slots from authenticated;
grant select on public.mentorship_slots to anon, authenticated;
grant insert (mentor_id, starts_at, ends_at) on public.mentorship_slots to authenticated;
grant update (starts_at, ends_at) on public.mentorship_slots to authenticated;
grant delete on public.mentorship_slots to authenticated;

revoke insert, update, delete on public.mentor_profiles from anon, authenticated;
grant select on public.mentor_profiles to anon, authenticated;
grant insert (user_id, headline, bio, expertise, organization)
  on public.mentor_profiles to authenticated;
grant update (headline, bio, expertise, organization)
  on public.mentor_profiles to authenticated;

revoke all on public.private_registration_profiles from anon, authenticated;
grant select on public.private_registration_profiles to authenticated;

create policy "Users can read their own account"
  on public.users for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can read their own private registration details"
  on public.private_registration_profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Public can read names of published request students"
  on public.users for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.scholarship_requests
      where student_id = id and status in ('active', 'funded', 'completed')
    )
  );

create policy "Public can read names of listed mentors"
  on public.users for select
  to anon, authenticated
  using (exists (select 1 from public.mentor_profiles where user_id = id));

create policy "Users can update their own basic account details"
  on public.users for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Student profiles are publicly readable"
  on public.student_profiles for select
  to anon, authenticated
  using (true);

create policy "Students can create their own profile"
  on public.student_profiles for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Students can update their own profile"
  on public.student_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Public can read published scholarship requests"
  on public.scholarship_requests for select
  to anon, authenticated
  using (status in ('active', 'funded', 'completed'));

create policy "Students can read their own scholarship requests"
  on public.scholarship_requests for select
  to authenticated
  using (student_id = (select auth.uid()));

create policy "Students can create their own scholarship requests"
  on public.scholarship_requests for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and raised_amount_lkr = 0
    and (
      proof_document_path is null
      or split_part(proof_document_path, '/', 1) = (select auth.uid())::text
    )
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Students can edit their own pending scholarship requests"
  on public.scholarship_requests for update
  to authenticated
  using (student_id = (select auth.uid()) and status = 'pending')
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and (
      proof_document_path is null
      or split_part(proof_document_path, '/', 1) = (select auth.uid())::text
    )
  );

create policy "Milestones are readable for published requests"
  on public.milestones for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.scholarship_requests
      where id = request_id and status in ('active', 'funded', 'completed')
    )
  );

create policy "Students can read milestones on their own requests"
  on public.milestones for select
  to authenticated
  using (
    exists (
      select 1
      from public.scholarship_requests
      where id = request_id and student_id = (select auth.uid())
    )
  );

create policy "Students can add milestones to their own requests"
  on public.milestones for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      receipt_path is null
      or split_part(receipt_path, '/', 1) = (select auth.uid())::text
    )
    and exists (
      select 1
      from public.scholarship_requests
      where id = request_id and student_id = (select auth.uid())
    )
  );

create policy "Students can update milestones on their own requests"
  on public.milestones for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.scholarship_requests
      where id = request_id and student_id = (select auth.uid())
    )
  )
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.scholarship_requests
      where id = request_id and student_id = (select auth.uid())
    )
  );

-- Donation records are private to the donor and are written by trusted payment
-- verification code using the service role, not directly by browser clients.
create policy "Donors can read their own donations"
  on public.donations for select
  to authenticated
  using (donor_id = (select auth.uid()));

create policy "Mentors can read available or their own mentorship slots"
  on public.mentorship_slots for select
  to anon, authenticated
  using (
    booked_by is null
    or mentor_id = (select auth.uid())
    or booked_by = (select auth.uid())
  );

create policy "Mentors can create their own slots"
  on public.mentorship_slots for insert
  to authenticated
  with check (
    mentor_id = (select auth.uid())
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'mentor'
    )
    and booked_by is null
  );

create policy "Mentors can update their own unbooked slots"
  on public.mentorship_slots for update
  to authenticated
  using (mentor_id = (select auth.uid()) and booked_by is null)
  with check (mentor_id = (select auth.uid()));

create policy "Mentors can delete their own unbooked slots"
  on public.mentorship_slots for delete
  to authenticated
  using (mentor_id = (select auth.uid()) and booked_by is null);

create policy "Mentors are publicly listed"
  on public.mentor_profiles for select
  to anon, authenticated
  using (true);

create policy "Mentors can create their own profile"
  on public.mentor_profiles for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.users
      where id = (select auth.uid()) and role = 'mentor'
    )
  );

create policy "Mentors can update their own profile"
  on public.mentor_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.users
      where id = (select auth.uid()) and role = 'mentor'
    )
  );

create or replace function public.book_mentorship_slot(slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_role public.user_role;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select role into current_role
  from public.users
  where id = current_user_id;

  if current_role is distinct from 'student'::public.user_role then
    raise exception 'Only student accounts can book mentorship slots';
  end if;

  update public.mentorship_slots
  set booked_by = current_user_id, booked_at = now()
  where id = slot_id
    and booked_by is null
    and starts_at > now()
    and mentor_id <> current_user_id;

  if not found then
    raise exception 'This mentorship slot is no longer available';
  end if;
end
$$;

revoke all on function public.book_mentorship_slot(uuid) from public, anon;
grant execute on function public.book_mentorship_slot(uuid) to authenticated;

-- Proof documents are private. The first object-path segment must be the
-- authenticated student's user ID; clients never receive public file URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scholarship-proofs',
  'scholarship-proofs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Students can upload their own proof documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scholarship-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Students can read their own proof documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scholarship-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students can remove their own proof documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'scholarship-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Students upload their own verification documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Students read their own verification documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students remove their own verification documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Receipt uploads are also private; supporters receive only short-lived signed
-- links for receipts attached to milestones on campaigns they can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-receipts',
  'milestone-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Students can upload their own milestone receipts"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'milestone-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.users
      where id = (select auth.uid()) and role = 'student'
    )
  );

create policy "Students can read their own milestone receipts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'milestone-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students can remove their own milestone receipts"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'milestone-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- This aggregate supports campaign progress without exposing individual donor
-- records. Configure campaign/payment status transitions in trusted server code.
create or replace view public.request_fundraising_totals
with (security_invoker = false)
as
select request_id, coalesce(sum(amount_lkr), 0)::bigint as raised_amount_lkr
from public.donations
where status = 'confirmed'
group by request_id;

grant select on public.request_fundraising_totals to anon, authenticated;
