# EduScan AI — Điểm danh QR, học phí, bài tập và chấm bài AI

Ứng dụng web (PWA) cho giáo viên và học viên. Frontend React + Vite, backend Express, dữ liệu lưu trong Postgres (Supabase).

## Chạy trên máy

Yêu cầu: Node.js 22, một chuỗi kết nối Postgres (Supabase).

```bash
npm ci --legacy-peer-deps
cp .env.example .env        # điền DATABASE_URL (và GEMINI_API_KEY nếu cần AI)
npm run dev                 # chạy ở http://localhost:3000, tự migrate và nạp dữ liệu demo
```

Tài khoản demo (chỉ dev): `teacher@eduscan.edu.vn`, `student@qnu.edu.vn`, `admin@eduscan.edu.vn`, mật khẩu `123456`.

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

## Cấu trúc frontend

- Địa chỉ trang: giáo viên `/dashboard`, `/attendance`, `/classes`, `/students`, `/tuition` (admin), `/homework`, `/stats`, `/teachers` (admin); học viên `/home`, `/assignments`, `/attendance`, `/tuition`, `/notifications`. Lớp chọn sẵn đi kèm tham số, VD `/attendance?class=<id>`. Đường dẫn sai hoặc không đủ quyền chuyển về trang mặc định. Định nghĩa ở `src/app/routes.ts`.
- `src/App.tsx`: đăng nhập, khung trang, tải dữ liệu. `src/app/TeacherApp.tsx` và `src/app/StudentApp.tsx` là hai giao diện theo vai trò, tải riêng (lazy) nên học viên không tải mã của giáo viên.
- Dữ liệu: `src/hooks/data/` mỗi tính năng một hook (lớp, học viên, điểm danh, bài tập, học phí, giáo viên, thông báo, sao lưu); `src/hooks/useEcosystemData.ts` ghép chúng lại, lo tải lần đầu, làm mới và các thao tác chạm nhiều tính năng.
- Kiểu dữ liệu: `src/shared/types/index.ts` là nguồn duy nhất, dùng chung cho giao diện và server (DTO trong `server/lib/dto.ts` khai báo kiểu trả về theo đó nên lệch nhau là tsc báo lỗi). Giao diện dùng thẳng dữ liệu API, không có lớp chuyển đổi. Dữ liệu biểu mẫu gửi lên là `ClassInput`, `StudentInput`, `AssignmentInput`, `GradeInput`.
- Giao diện: màu theo ngữ nghĩa `primary`, `success`, `warning`, `danger`, `accent` (và `slate` cho trung tính) khai báo một chỗ trong `src/index.css`; không dùng tên màu thô như `blue-600`. Chữ tối thiểu 12px (`text-xs`). Phần tử bấm được không phải `<button>` dùng `clickable()` (`src/shared/utils/a11y.tsx`). `tests/unit/design-rules.test.ts` kiểm tra các quy ước này.
- Hộp thoại dùng chung (`src/shared/components/ui`): `Modal`, `useConfirm()` thay cho `window.confirm`, và `useIssuedPassword()` hiện mật khẩu tạm vừa cấp (giáo viên, học viên) trong hộp thoại không tự tắt, có nút sao chép thông tin đăng nhập; đặt ở cấp ứng dụng nên không mất khi chuyển trang.
- Máy chủ phải trả `index.html` cho mọi đường dẫn không bắt đầu bằng `/api` (server.ts đã làm). Nếu đặt frontend trên static host riêng, cần cấu hình rewrite tương tự.

## Lịch giảng

- Admin đặt lịch lặp cho từng lớp (nút **Lịch** trên thẻ lớp): chọn thứ, giờ học, ngày bắt đầu, và kết thúc theo số tuần hoặc ngày. Form tự xem trước (không ghi DB) số buổi sẽ thêm, bỏ, đổi giờ, các ngày nghỉ bị bỏ và xung đột giáo viên/phòng; bấm **Áp dụng lịch** mới ghi.
- Mỗi lớp tối đa một buổi mỗi ngày (`lessons`, unique `class_id + lesson_date`). Ngày và giờ là `date`/`time` thuần, không có múi giờ. Chuỗi `classes.schedule` được server sinh lại từ lịch lặp nên Tổng quan và các màn hình cũ vẫn đọc được.
- **Đồng bộ chỉ đụng buổi chưa chốt.** Buổi được giữ nguyên nếu đã qua (từ hôm nay trở về trước), đã có phiên điểm danh (QR hoặc nhanh, nối theo `class_id + session_date`, không cần `lesson_id`), đã bị hủy, hoặc admin đã sửa tay hay nhập nội dung (`manually_edited`).
- **Ngày nghỉ chung** (`holidays`, admin quản lý): thêm hoặc xóa ngày nghỉ áp lại lịch của mọi lớp theo cùng quy tắc trên.
- **Trùng lịch:** hai buổi cùng ngày, chồng giờ, và trùng giáo viên phụ trách hoặc phòng học (không phân biệt hoa thường) bị báo. Áp lịch bị chặn (409) trừ khi admin chọn "Vẫn áp dụng dù bị trùng".
- Quyền: chỉ admin tạo và sửa lịch, ngày nghỉ. Giáo viên xem lịch lớp mình phụ trách, học viên xem lịch lớp đang học. Tổng quan hiện nội dung buổi hôm nay; cổng học viên hiện các buổi sắp tới.

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

- Mã QR do server ký (HMAC-SHA256, khóa suy ra từ `JWT_SECRET`), đổi mỗi 15 giây, gắn với đúng một phiên và chấp nhận thêm chu kỳ liền trước. Học viên không thể tự dựng mã, nhưng vẫn có thể chụp màn hình gửi cho bạn đang ở xa trong tối đa 30 giây. Đổi `JWT_SECRET` thì mã đang hiển thị mất hiệu lực (giáo viên chỉ cần chờ chu kỳ kế tiếp).
- Mã phiên nhập tay (`ES-xxxx`) dùng cho học viên không có camera và không đổi trong suốt phiên, nên ai nhìn thấy trên màn chiếu cũng có thể gửi đi. Phiên được đóng khi giáo viên tắt màn hình QR Live (hoặc mở phiên mới), sau đó mã nhập tay không dùng được nữa. Nếu cần chặt hơn, hãy tắt QR Live ngay khi bắt đầu giờ học.
- RLS bật trên mọi bảng (migration 0002) và không có policy: Data API của Supabase (anon/authenticated) không đọc được dữ liệu; server dùng role postgres nên không bị ảnh hưởng.
