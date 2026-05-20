-- ============================================================================
-- PR2b RPC — get_user_data() single-roundtrip-at-login
-- security invoker + RLS gating naturale (no DEFINER, no search_path attack).
-- Ritorna JSON con 6 array attivi + cestino object (soft-delete entries).
-- ============================================================================

create or replace function get_user_data()
returns json
language sql
security invoker
set search_path = public
stable
as $$
  select json_build_object(
    'tipi_utenza',     coalesce((select json_agg(t.*) from tipi_utenza t where t.user_id = auth.uid()), '[]'::json),
    'banche',          coalesce((select json_agg(b.*) from banche b where b.user_id = auth.uid() and b.deleted_at is null), '[]'::json),
    'proprieta',       coalesce((select json_agg(p.*) from proprieta p where p.user_id = auth.uid() and p.deleted_at is null), '[]'::json),
    'inquilini',       coalesce((select json_agg(i.*) from inquilini i where i.user_id = auth.uid() and i.deleted_at is null), '[]'::json),
    'incassi_affitti', coalesce((select json_agg(ic.*) from incassi_affitti ic where ic.user_id = auth.uid() and ic.deleted_at is null), '[]'::json),
    'utenze',          coalesce((select json_agg(u.*) from utenze u where u.user_id = auth.uid() and u.deleted_at is null), '[]'::json),
    'cestino', json_build_object(
      'banche',          coalesce((select json_agg(b.*) from banche b where b.user_id = auth.uid() and b.deleted_at is not null), '[]'::json),
      'proprieta',       coalesce((select json_agg(p.*) from proprieta p where p.user_id = auth.uid() and p.deleted_at is not null), '[]'::json),
      'inquilini',       coalesce((select json_agg(i.*) from inquilini i where i.user_id = auth.uid() and i.deleted_at is not null), '[]'::json),
      'incassi_affitti', coalesce((select json_agg(ic.*) from incassi_affitti ic where ic.user_id = auth.uid() and ic.deleted_at is not null), '[]'::json),
      'utenze',          coalesce((select json_agg(u.*) from utenze u where u.user_id = auth.uid() and u.deleted_at is not null), '[]'::json)
    )
  );
$$;

grant execute on function get_user_data() to authenticated;
