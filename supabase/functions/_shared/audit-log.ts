// supabase/functions/_shared/audit-log.ts
// Centralized security & financial audit logging

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuditLogEntry {
  actorId?: string;
  actorType: 'admin' | 'user' | 'system' | 'offerwall';
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('audit_logs').insert({
      actor_id: entry.actorId || null,
      actor_type: entry.actorType,
      action: entry.action,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      details: entry.details || {},
      ip_address: entry.ipAddress || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AUDIT_LOG_FAILURE]', err);
  }
}
