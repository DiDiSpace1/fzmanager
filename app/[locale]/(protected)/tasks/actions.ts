'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function completePortfolioTaskAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const taskKey = value(formData, 'task_key');
  const taskType = value(formData, 'task_type');
  const title = value(formData, 'title');
  const meta = value(formData, 'meta');
  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPaidAccess(billing) || normalizeBillingPlan(billing?.plan) !== 'portfolio') {
    redirect(`${localizedPath(locale, '/tasks')}?error=portfolio_required`);
  }

  if (!taskKey || !taskType || !title) {
    redirect(`${localizedPath(locale, '/tasks')}?error=invalid_task`);
  }

  const {error} = await supabase.from('task_completion_events').upsert(
    {meta: meta || null, task_key: taskKey, task_type: taskType, title, user_id: user.id, workspace_id: workspaceId},
    {onConflict: 'workspace_id,user_id,task_key'}
  );

  if (error) {
    redirect(`${localizedPath(locale, '/tasks')}?error=complete_failed`);
  }

  revalidatePath(localizedPath(locale, '/tasks'));
  redirect(`${localizedPath(locale, '/tasks')}?success=completed`);
}
