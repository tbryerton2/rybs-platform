alter table public.payment_exceptions
  add column if not exists booking_id uuid references public.bookings (id) on delete set null,
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists failure_stage text,
  add column if not exists safe_error_code text,
  add column if not exists sanitized_error_message text,
  add column if not exists attempted_at timestamptz not null default now(),
  add column if not exists retryable boolean not null default false,
  add column if not exists correlation_id text;

create index if not exists payment_exceptions_booking_id_idx
  on public.payment_exceptions (booking_id);

create index if not exists payment_exceptions_customer_id_idx
  on public.payment_exceptions (customer_id);

create index if not exists payment_exceptions_failure_stage_idx
  on public.payment_exceptions (failure_stage);

create index if not exists payment_exceptions_safe_error_code_idx
  on public.payment_exceptions (safe_error_code);

create index if not exists payment_exceptions_correlation_id_idx
  on public.payment_exceptions (correlation_id);
