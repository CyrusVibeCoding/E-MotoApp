-- Run once as the database owner after enabling Supabase Cron (pg_cron).
select cron.schedule('emoto-group-cleanup', '* * * * *',
  'select emoto_private.cleanup()');
