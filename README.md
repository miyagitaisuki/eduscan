# EduScan AI — Điểm danh QR, học phí, bài tập và chấm bài AI

Ứng dụng web (PWA) cho giáo viên và học viên. Frontend React + Vite, backend Express, dữ liệu lưu trong Postgres (Supabase).

## Chạy trên máy

Yêu cầu: Node.js 22, một chuỗi kết nối Postgres (Supabase).

```bash
npm ci --legacy-peer-deps
cp .env.example .env        # điền DATABASE_URL (và GEMINI_API_KEY nếu cần AI)
npm run dev                 # chạy ở http://localhost:3000, tự migrate và nạp dữ liệu demo
```

Tài khoản demo (chỉ dev): `teacher@eduscan.edu.vn`, `student@eduscan.edu.vn`, `admin@eduscan.edu.vn`, mật khẩu `123456`.

## Kiểm thử

```bash
npm run lint    # kiểm tra kiểu
npm test        # kiểm thử API với Postgres trong bộ nhớ (PGlite), không cần DATABASE_URL
```

## Cơ sở dữ liệu

- Schema: `server/db/schema.ts` (Drizzle). Migration SQL: `drizzle/`.
- Sinh migration mới sau khi đổi schema: `npm run db:generate`.
- Chạy migration thủ công: `DIRECT_URL=... npm run db:migrate` (session pooler, cổng 5432).

## Triển khai production

1. Tạo project Supabase, đặt `DATABASE_URL` = transaction pooler (6543), `DIRECT_URL` = session pooler (5432), `DATABASE_CA_CERT` = CA tải từ Dashboard (Database > SSL Configuration).
2. Tạo `JWT_SECRET` ngẫu nhiên (ít nhất 32 ký tự): `openssl rand -hex 32`.
3. Đặt `SEED_PASSWORD` cho tài khoản admin và giáo viên ban đầu. Nếu bỏ trống, server in mật khẩu ngẫu nhiên ra log một lần khi khởi tạo — ghi lại ngay.
4. Đặt `CORS_ORIGIN` là domain frontend (nếu khác nguồn với API).
5. Build và chạy image:

```bash
docker build -t eduscan .
docker run -p 3000:3000 --env-file .env eduscan
```

Đặt sau một reverse proxy có HTTPS (Cloud Run, Render, Fly.io, Caddy...). **HTTPS là bắt buộc** để quét QR bằng camera trên điện thoại hoạt động, vì trình duyệt chỉ cho phép camera trên nguồn an toàn. Đặt `TRUST_PROXY=1` (hoặc số hop tương ứng) để giới hạn đăng nhập theo đúng IP.

## Sao lưu

- **Lớp chính:** sao lưu tự động của Supabase (gói có sao lưu hằng ngày/PITR). Kiểm tra gói đang dùng có bật tính năng này.
- **Lớp bổ sung:** workflow `.github/workflows/backup.yml` chạy `pg_dump` hằng ngày, cần secret `SUPABASE_DB_URL`.
- **Sao lưu thủ công:** admin bấm "Sao lưu" trên thanh công cụ để tải file JSON. File này chứa băm mật khẩu, cần cất giữ như dữ liệu nhạy cảm. "Phục hồi" thay thế toàn bộ dữ liệu và yêu cầu xác nhận.

## Bảo mật đã áp dụng

- Mật khẩu băm bằng scrypt; đăng nhập bị giới hạn theo IP và theo tài khoản (10 lần sai / 15 phút).
- Mọi API cần token JWT; quyền được kiểm tra lại trong cơ sở dữ liệu ở mỗi request, nên tài khoản bị khóa mất quyền ngay.
- Học viên chỉ truy cập dữ liệu của chính mình; route ghi chỉ dành cho giáo viên/admin.
- Production bắt buộc `JWT_SECRET`; không có mật khẩu mặc định trong môi trường production.
- AI không bao giờ trả điểm hay nhận xét giả khi lỗi; giáo viên luôn duyệt kết quả trước khi lưu.

## Giới hạn đã biết

- Mã QR đổi mỗi 15 giây và chấp nhận chu kỳ trước đó; học viên vẫn có thể chụp và gửi mã trong thời gian đó.
- RLS bật trên mọi bảng (migration 0002) và không có policy: Data API của Supabase (anon/authenticated) không đọc được dữ liệu; server dùng role postgres nên không bị ảnh hưởng.
