import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, ADMIN } from '../helpers';
import { leads } from '../../server/db/schema';
import { eq } from 'drizzle-orm';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let A: string;

beforeAll(async () => {
  ctx = await createTestContext();
  A = await ctx.login(ADMIN);
  // Seed has no lessons: create a 3-week schedule so the backup contains `time` columns.
  const planned = await ctx.api.post('/api/classes/cls-n5-01/lesson-plan').set(auth(A)).send({
    weekdays: [1, 3, 5],
    start_time: '18:00',
    end_time: '19:30',
    start_date: '2030-01-07',
    weeks: 3,
  });
  expect(planned.status).toBe(200);
});
afterAll(async () => {
  await ctx.close();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('audit: backup/restore', () => {
  it('restores a backup that contains lessons', async () => {
    const backup = await ctx.api.get('/api/admin/backup').set(auth(A));
    expect(backup.status).toBe(200);
    expect(backup.body.tables.lessons.length).toBeGreaterThan(0);

    const restore = await ctx.api.post('/api/admin/restore').set(auth(A)).send({
      confirm: 'RESTORE',
      data: backup.body,
    });
    expect(restore.status).toBe(200);
  });

  it('includes CRM leads and restores them with consent_at as a timestamp', async () => {
    await ctx.db.insert(leads).values({
      id: 'lead-audit-1',
      fullName: 'Lead Audit',
      phone: '0900000001',
      consentAt: new Date('2026-10-01T08:00:00Z'),
    });

    const backup = await ctx.api.get('/api/admin/backup').set(auth(A));
    expect(backup.body.tables.leads).toHaveLength(1);

    const restore = await ctx.api.post('/api/admin/restore').set(auth(A)).send({
      confirm: 'RESTORE',
      data: backup.body,
    });
    expect(restore.status).toBe(200);

    const rows = await ctx.db.select().from(leads).where(eq(leads.id, 'lead-audit-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].consentAt).toBeInstanceOf(Date);
  });
});
