import { describe, expect, it, vi, afterEach } from 'vitest';
import { deleteHomeworkObjects } from '../../server/lib/storage';

describe('deleteHomeworkObjects', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('gửi bulk delete với danh sách đường dẫn trong bucket homework', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await deleteHomeworkObjects(['a/b/1.jpg', 'a/b/2.pdf']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/storage/v1/object/homework');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ prefixes: ['a/b/1.jpg', 'a/b/2.pdf'] });
  });

  it('không gọi Storage khi không có tệp nào', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await deleteHomeworkObjects([]);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
