-- Web Push subscriptions for PWA notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub')
  with check (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

alter publication supabase_realtime add table public.push_subscriptions;

-- Trigger: when a mission is inserted with status 'pending', call send-push Edge Function via pg_net
create or replace function notify_push_on_pending_mission()
returns trigger
language plpgsql
security definer
as $$
declare
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key  text := current_setting('app.settings.service_role_key', true);
  _edge_url     text;
  _payload      jsonb;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  _edge_url := coalesce(_supabase_url, '') || '/functions/v1/send-push';
  _payload  := jsonb_build_object(
    'user_id',    new.user_id,
    'mission_id', new.id,
    'title',      'Tether #' || lpad(new.tether_number::text, 3, '0') || ' — Approval Required',
    'body',       coalesce(left(new.objective, 120), 'A new mission needs your approval.')
  );

  perform net.http_post(
    url     := _edge_url,
    body    := _payload,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(_service_key, '')
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_push_on_pending_mission on public.missions;
create trigger trg_push_on_pending_mission
  after insert on public.missions
  for each row
  when (new.status = 'pending')
  execute function notify_push_on_pending_mission();
