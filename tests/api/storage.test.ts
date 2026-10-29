import { describe, expect, it, vi, afterEach } from 'vitest';
import { createAttachmentSignedUrl, uploadHomeworkAttachment, StorageError } from '../../server/lib/storage';

const png = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');

describe('uploadHomeworkAttachment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('từ chối khi chưa cấu hình Supabase', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(uploadHomeworkAttachment(png, 'a/b')).rejects.toMatchObject({ status: 503 });
  });

  it('từ chối loại tệp không được phép', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    const exe = 'data:application/x-msdownload;base64,' + Buffer.from('x').toString('base64');
    await expect(uploadHomeworkAttachment(exe, 'a/b')).rejects.toBeInstanceOf(StorageError);
  });

  it('từ chối tệp quá 10 MB', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
    await expect(uploadHomeworkAttachment(big, 'a/b')).rejects.toMatchObject({ status: 413 });
  });

  it('upload lên bucket homework và trả về đường dẫn', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const path = await uploadHomeworkAttachment(png, 'asg1/stu1');
    expect(path).toMatch(/^homework\/asg1\/stu1\/\d+-[0-9a-f]+\.png$/);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/homework/${path.slice('homework/'.length)}`);
    expect(init.headers['Content-Type']).toBe('image/png');
  });
});

describe('createAttachmentSignedUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('đổi đường dẫn thành link tạm có token', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ signedURL: '/object/sign/homework/a/b.jpg?token=t' }), { status: 200 }))
    );
    const url = await createAttachmentSignedUrl('homework/a/b.jpg');
    expect(url).toBe('https://x.supabase.co/storage/v1/object/sign/homework/a/b.jpg?token=t');
  });

  it('từ chối đường dẫn không thuộc bucket homework', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    await expect(createAttachmentSignedUrl('other/a.jpg')).rejects.toMatchObject({ status: 400 });
  });
});
