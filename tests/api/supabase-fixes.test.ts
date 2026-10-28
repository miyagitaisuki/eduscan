import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import * as s from '../../server/db/schema';
import { sslConfig, stripPrismaParams } from '../../server/db/client';
import { todayStr } from '../../server/lib/http';
import { createTestContext, ADMIN } from '../helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>> | undefined;
afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe('Supabase deploy fixes', () => {
  it('todayStr uses Vietnam time, not UTC', () => {
    // 2026-10-27 18:30 UTC = 2026-10-28 01:30 giờ Việt Nam
    expect(todayStr(new Date('2026-10-27T18:30:00Z'))).toBe('2026-10-28');
  });

  it('ssl config: CA verifies, no CA still encrypts, false disables', () => {
    expect(sslConfig({ DATABASE_CA_CERT: 'A\nB' } as any)).toEqual({ ca: 'A\nB', rejectUnauthorized: true });
    expect(sslConfig({} as any)).toEqual({ rejectUnauthorized: false });
    expect(sslConfig({ DATABASE_SSL: 'false' } as any)).toBe(false);
  });

  it('strips Prisma-only params from the connection string', () => {
    const out = stripPrismaParams('postgresql://u:p%40w@h:6543/postgres?pgbouncer=true&application_name=x');
    expect(out).not.toContain('pgbouncer');
    expect(out).toContain('application_name=x');
    expect(out).toContain('p%40w');
  });

  it('RLS is enabled on every table', async () => {
    ctx = await createTestContext();
    const res: any = await ctx.db.execute(
      sql`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`
    );
    expect(res.rows ?? res).toEqual([]);
  });

  it('restore round-trips a submission with an AI draft', async () => {
    ctx = await createTestContext();
    await ctx.db.update(s.submissions).set({ aiDraft: { score: 8 }, aiDraftAt: new Date() }).where(sql`id = 'sub-2'`);
    const token = await ctx.login(ADMIN);
    const backup = await ctx.api.get('/api/admin/backup').set('Authorization', `Bearer ${token}`);
    expect(backup.status).toBe(200);
    const res = await ctx.api
      .post('/api/admin/restore')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirm: 'RESTORE', data: backup.body });
    expect(res.status).toBe(200);
  });
});
