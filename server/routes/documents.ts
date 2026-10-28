import { Router } from 'express';
import { DOC_TYPES, DocType } from '../lib/documents';
import { ah, AuthedRequest } from '../lib/http';
import type { Deps } from './deps';

// Thư viện đề thi, đáp án, học liệu. Mọi người dùng đăng nhập đều xem được (đã áp dụng ở cổng /api).
export function documentRoutes({ documents, auth }: Deps) {
  const r = Router();

  const notConfigured = (res: any) =>
    res.status(503).json({ error: 'Thư viện tài liệu chưa được cấu hình trên máy chủ.' });

  r.get(
    '/',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      if (!documents) return notConfigured(res);
      const type = req.query.type as string | undefined;
      const year = req.query.year ? Number(req.query.year) : undefined;
      if (type && !(DOC_TYPES as readonly string[]).includes(type)) {
        return res.status(400).json({ error: 'Loại tài liệu không hợp lệ.' });
      }
      if (year !== undefined && !Number.isInteger(year)) {
        return res.status(400).json({ error: 'Năm không hợp lệ.' });
      }
      const docs = await documents.list({
        q: req.query.q as string | undefined,
        subject: req.query.subject as string | undefined,
        year,
        type: type as DocType | undefined,
      });
      return res.json(docs);
    })
  );

  // Đồng bộ chỉ mục từ Drive. Dùng cho giáo viên sau khi thêm file, hoặc từ Render Cron.
  r.post(
    '/sync',
    auth.requireTeacher,
    ah(async (_req: AuthedRequest, res) => {
      if (!documents) return notConfigured(res);
      const result = await documents.sync();
      return res.json(result);
    })
  );

  // Chỉ tải được file đã có trong chỉ mục (status ok). Không cho tải file tùy ý theo ID.
  r.get(
    '/:id/download',
    auth.requireAuth,
    ah(async (req: AuthedRequest, res) => {
      if (!documents) return notConfigured(res);
      const doc = await documents.findOk(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });

      const file = await documents.openFile(doc.drive_file_id);
      res.setHeader('Content-Type', file.mimeType);
      if (file.size) res.setHeader('Content-Length', String(file.size));
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`
      );
      file.stream.on('error', () => res.destroy());
      file.stream.pipe(res);
    })
  );

  return r;
}
