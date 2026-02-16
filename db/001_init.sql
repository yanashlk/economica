create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'user');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type question_type as enum ('text', 'textarea', 'checkbox', 'date');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('draft', 'submitted');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  question_text text not null,
  qtype question_type not null,
  required boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questions_form on questions(form_id, sort_order);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  status submission_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz null
);

create index if not exists idx_submissions_form_status on submissions(form_id, status, created_at desc);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  value_text text null,
  value_bool boolean null,
  value_date date null,
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

alter table answers
  add constraint chk_answers_one_value
  check (
    (value_text is not null)::int +
    (value_bool is not null)::int +
    (value_date is not null)::int <= 1
  );

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references users(id) on delete set null,
  submission_id uuid null references submissions(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_submission on audit_log(submission_id, created_at desc);
