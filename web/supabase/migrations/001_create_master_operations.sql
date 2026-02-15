-- Master Specialties
create table if not exists master_specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

-- Master Fields (body parts/anatomical regions)
create table if not exists master_fields (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

-- Master Operations
create table if not exists master_operations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  body_region text,
  is_ai_generated boolean default false,
  approved boolean default false,
  has_been_used boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(name)
);

-- Operation to Specialties (many-to-many)
create table if not exists operation_specialties (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references master_operations(id) on delete cascade,
  specialty_id uuid not null references master_specialties(id) on delete cascade,
  created_at timestamptz default now(),
  unique(operation_id, specialty_id)
);

-- Operation to Fields (many-to-many)
create table if not exists operation_fields (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references master_operations(id) on delete cascade,
  field_id uuid not null references master_fields(id) on delete cascade,
  created_at timestamptz default now(),
  unique(operation_id, field_id)
);

-- Master Complications
create table if not exists master_complications (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references master_operations(id) on delete cascade,
  name text not null,
  description text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  is_ai_generated boolean default false,
  approved boolean default false,
  is_systemic boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indices
create index idx_operation_specialties_operation on operation_specialties(operation_id);
create index idx_operation_specialties_specialty on operation_specialties(specialty_id);
create index idx_operation_fields_operation on operation_fields(operation_id);
create index idx_operation_fields_field on operation_fields(field_id);
create index idx_master_complications_operation on master_complications(operation_id);

-- RLS Policies (admin-only access)
alter table master_specialties enable row level security;
alter table master_fields enable row level security;
alter table master_operations enable row level security;
alter table operation_specialties enable row level security;
alter table operation_fields enable row level security;
alter table master_complications enable row level security;

-- Allow authenticated users to read (anyone can view master list)
create policy "Allow all users to read master_specialties" on master_specialties
  for select using (true);

create policy "Allow all users to read master_fields" on master_fields
  for select using (true);

create policy "Allow all users to read master_operations" on master_operations
  for select using (true);

create policy "Allow all users to read operation_specialties" on operation_specialties
  for select using (true);

create policy "Allow all users to read operation_fields" on operation_fields
  for select using (true);

create policy "Allow all users to read master_complications" on master_complications
  for select using (true);

-- Admin-only write access (restrict via application logic)
create policy "Allow admin to insert master_specialties" on master_specialties
  for insert with check (auth.jwt() ->> 'role' = 'authenticated');

create policy "Allow admin to update master_specialties" on master_specialties
  for update using (auth.jwt() ->> 'role' = 'authenticated');

create policy "Allow admin to delete master_specialties" on master_specialties
  for delete using (auth.jwt() ->> 'role' = 'authenticated');
