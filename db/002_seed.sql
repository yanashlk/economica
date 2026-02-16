-- 1) Admin user
insert into users (email, password_hash, role, is_active)
values (
  'vt221_shyai@student.ztu.edu.ua',
  crypt('admin12345', gen_salt('bf', 12)),
  'admin',
  true
)
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = excluded.is_active;

-- 2) Default form
insert into forms (slug, title, is_active)
values ('main-brief', 'Бриф', true)
on conflict (slug) do update
set
  title = excluded.title,
  is_active = excluded.is_active,
  updated_at = now();

-- 3) Questions (idempotent insert через "нема такого питання в формі")
with f as (
  select id from forms where slug = 'main-brief'
)
insert into questions (form_id, question_text, qtype, required, sort_order, is_active)
select f.id, q.question_text, q.qtype::question_type, q.required, q.sort_order, true
from f
join (values
  ('Як вас звати?', 'text', true, 1),
  ('Контакт (телефон/telegram)?', 'text', true, 2),
  ('Коротко опишіть запит', 'textarea', true, 3),
  ('Чи є дедлайн?', 'checkbox', false, 4),
  ('Орієнтовна дата очікування проєкту', 'date', false, 5)
) as q(question_text, qtype, required, sort_order)
on true
where not exists (
  select 1
  from questions qq
  where qq.form_id = f.id
    and qq.question_text = q.question_text
);