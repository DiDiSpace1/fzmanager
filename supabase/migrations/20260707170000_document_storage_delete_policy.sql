drop policy if exists "Members can delete document files" on storage.objects;

create policy "Members can delete document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);
