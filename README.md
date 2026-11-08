# IMEJI日本語教室 (Lớp học tiếng Nhật thầy Quang) — Cổng học viên và giáo viên: điểm danh, lịch học, học phí, bài tập, luyện tập Minna và chấm bài AI

Ứng dụng web (PWA) cho giáo viên và học viên. Frontend React + Vite, backend Express, dữ liệu lưu trong Postgres (Supabase).

## Chạy trên máy

Yêu cầu: Node.js 22, một chuỗi kết nối Postgres (Supabase).

```bash
npm ci --legacy-peer-deps
# tạo file .env với các biến ở mục "Biến môi trường" bên dưới (ít nhất DATABASE_URL)
npm run dev                 # chạy ở http://localhost:3000, tự migrate và nạp dữ liệu demo
```

Tài khoản demo (chỉ dev): `teacher@eduscan.edu.vn`, `student@qnu.edu.vn`, `admin@eduscan.edu.vn`, mật khẩu `123456`.

## Biến môi trường

Đặt trong file `.env` (không commit, đã có trong `.gitignore`) hoặc trên máy chủ. Không ghi giá trị thật vào bất kỳ file nào trong repo.

- Bắt buộc: `DATABASE_URL` (transaction pooler, cổng 6543), `JWT_SECRET` (ít nhất 32 ký tự, tạo bằng `openssl rand -hex 32`), `APP_URL` (địa chỉ frontend, bắt buộc khi `NODE_ENV=production` để tạo liên kết đặt lại mật khẩu).
- Khuyến nghị: `DIRECT_URL` (session pooler, cổng 5432, dùng cho migration), `DATABASE_CA_CERT` (nội dung PEM hoặc đường dẫn file .crt), `SEED_PASSWORD`, `SEED_TEACHER_NAME`, `CORS_ORIGIN`, `APP_TZ` (mặc định nên là `Asia/Ho_Chi_Minh`).
- Tùy chọn: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (tệp đính kèm bài làm), `GEMINI_API_KEY`, `GEMINI_MODEL` (AI), `AUTO_MIGRATE`, `DATABASE_SSL` (`false` chỉ khi Postgres cục bộ không có SSL), `PORT`, `NODE_ENV`, `TRUST_PROXY`, `LEADS_NOTIFY_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM`, `REGISTRATION_MODE` (`open` mặc định, `invite` hoặc `closed`), `REGISTRATION_INVITE_CODE` (bắt buộc khi `REGISTRATION_MODE=invite`).

## Kiểm thử

```bash
npm run lint    # kiểm tra kiểu
npm test        # kiểm thử API với Postgres trong bộ nhớ (PGlite), không cần DATABASE_URL
```

PGlite chỉ có một kết nối nên không tái hiện được race condition thật. Để chạy thêm bài kiểm thử đồng thời trên Postgres thật (tự tạo và xóa một database con), đặt `EDUSCAN_TEST_DATABASE_URL` trỏ tới database có tên chứa `test`:

```bash
# Postgres cục bộ không bật SSL thì thêm DATABASE_SSL=false
EDUSCAN_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/eduscan_test \
  npm test -- tests/integration/postgres-concurrency.test.ts
```

Bài kiểm thử này bị bỏ qua khi biến môi trường không được đặt.

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

Đặt sau một reverse proxy có HTTPS (Cloud Run, Render, Fly.io, Caddy...). **HTTPS là bắt buộc**: bảo vệ mật khẩu và token đăng nhập, và trình duyệt chỉ cho cài ứng dụng (PWA) trên nguồn an toàn. Đặt `TRUST_PROXY=1` (hoặc số hop tương ứng) để giới hạn đăng nhập theo đúng IP.

## Cấu trúc frontend

- Địa chỉ trang: giáo viên `/dashboard`, `/attendance`, `/classes`, `/students`, `/tuition` (admin), `/homework`, `/stats`, `/teachers` (admin); học viên `/home`, `/assignments`, `/attendance`, `/tuition`, `/notifications`. Lớp chọn sẵn đi kèm tham số, VD `/attendance?class=<id>`. Đường dẫn sai hoặc không đủ quyền chuyển về trang mặc định. Định nghĩa ở `src/app/routes.ts`.
- `src/App.tsx`: đăng nhập, khung trang, tải dữ liệu. `src/app/TeacherApp.tsx` và `src/app/StudentApp.tsx` là hai giao diện theo vai trò, tải riêng (lazy) nên học viên không tải mã của giáo viên.
- Dữ liệu: `src/hooks/data/` mỗi tính năng một hook (lớp, học viên, điểm danh, bài tập, học phí, giáo viên, thông báo, sao lưu); `src/hooks/useEcosystemData.ts` ghép chúng lại, lo tải lần đầu, làm mới và các thao tác chạm nhiều tính năng.
- Kiểu dữ liệu: `src/shared/types/index.ts` là nguồn duy nhất, dùng chung cho giao diện và server (DTO trong `server/lib/dto.ts` khai báo kiểu trả về theo đó nên lệch nhau là tsc báo lỗi). Giao diện dùng thẳng dữ liệu API, không có lớp chuyển đổi. Dữ liệu biểu mẫu gửi lên là `ClassInput`, `StudentInput`, `AssignmentInput`, `GradeInput`.
- Giao diện: màu theo ngữ nghĩa `primary`, `success`, `warning`, `danger`, `accent` (và `slate` cho trung tính) lấy từ bộ quy chuẩn thương hiệu `src/styles/imeji-brand.css` (xem mục bên dưới), `src/index.css` chỉ nối vào Tailwind; không dùng tên màu thô như `blue-600`. Chữ tối thiểu 12px (`text-xs`). Phần tử bấm được không phải `<button>` dùng `clickable()` (`src/shared/utils/a11y.tsx`). `tests/unit/design-rules.test.ts` kiểm tra các quy ước này.
- Hộp thoại dùng chung (`src/shared/components/ui`): `Modal`, `useConfirm()` thay cho `window.confirm`, và `useIssuedPassword()` hiện mật khẩu tạm vừa cấp (giáo viên, học viên) trong hộp thoại không tự tắt, có nút sao chép thông tin đăng nhập; đặt ở cấp ứng dụng nên không mất khi chuyển trang.
- Máy chủ phải trả `index.html` cho mọi đường dẫn không bắt đầu bằng `/api` (server.ts đã làm). Nếu đặt frontend trên static host riêng, cần cấu hình rewrite tương tự.

## Bộ quy chuẩn thương hiệu

Màu, font, bo góc, bóng, nền chấm và thẻ kính mờ nằm trong `src/styles/imeji-brand.css`, **giống hệt nhau** ở 3 repo: imeji_newhorizon (website, giữ bản gốc), imeji_dominion (luyện tập) và eduscan (cổng học viên). Quy ước dùng ghi ở đầu file đó.

- Màu theo ý nghĩa: `primary` (thương hiệu, #2563eb), `success`, `warning`, `danger`, `accent`, cùng `slate` cho trung tính. Không dùng tên màu thô như `blue-600`, `emerald-500`, `bg-[#...]`.
- Font: Be Vietnam Pro, chữ Nhật dùng Noto Sans JP (`font-jp`).
- Muốn đổi: sửa bản gốc ở imeji_newhorizon, chép y nguyên sang 2 repo kia, rồi chạy `npm run brand:check` để so với bản gốc trên GitHub.

Font được tự host bằng `@fontsource` (CSP production chặn Google Fonts, và PWA vẫn có font khi mất mạng).

Header có **thanh chuyển 3 app** dùng chung với website và trang luyện tập (`src/shared/components/EcosystemSwitch.tsx`, kiểu `.imeji-switch`). Địa chỉ website, trang luyện tập và thông tin liên hệ nằm ở `src/shared/config/ecosystem.ts` (website đổi bằng `VITE_MINNA_ORIGIN`). Màn hình đăng nhập và đặt lại mật khẩu dùng nền mây và logo trong `public/brand/`; cổng học viên có chân trang chung (`SiteFooter`).

## Lịch giảng

- Admin đặt lịch lặp cho từng lớp (nút **Lịch** trên thẻ lớp): chọn thứ, giờ học, ngày bắt đầu, và kết thúc theo số tuần hoặc ngày. Form tự xem trước (không ghi DB) số buổi sẽ thêm, bỏ, đổi giờ, các ngày nghỉ bị bỏ và xung đột giáo viên/phòng; bấm **Áp dụng lịch** mới ghi.
- Mỗi lớp tối đa một buổi mỗi ngày (`lessons`, unique `class_id + lesson_date`). Ngày và giờ là `date`/`time` thuần, không có múi giờ. Chuỗi `classes.schedule` được server sinh lại từ lịch lặp nên Tổng quan và các màn hình cũ vẫn đọc được.
- **Đồng bộ chỉ đụng buổi chưa chốt.** Buổi được giữ nguyên nếu đã qua (từ hôm nay trở về trước), đã có phiên điểm danh (QR hoặc nhanh, nối theo `class_id + session_date`, không cần `lesson_id`), đã bị hủy, hoặc admin đã sửa tay hay nhập nội dung (`manually_edited`).
- **Ngày nghỉ chung** (`holidays`, admin quản lý): thêm hoặc xóa ngày nghỉ áp lại lịch của mọi lớp theo cùng quy tắc trên.
- **Trùng lịch:** hai buổi cùng ngày, chồng giờ, và trùng giáo viên phụ trách hoặc phòng học (không phân biệt hoa thường) bị báo. Áp lịch bị chặn (409) trừ khi admin chọn "Vẫn áp dụng dù bị trùng".
- **Giáo viên phụ trách** sửa được nội dung và ghi chú các buổi của lớp mình (không đổi ngày, giờ, hủy hoặc xóa buổi; server từ chối). Cổng học viên có mục "Hôm nay học gì".
- **Xuất / nhập CSV nội dung buổi học** (không cần Gemini): "Xuất CSV (file mẫu)" tải lịch lớp ra file có cột Ngày, Thứ, Giờ, Trạng thái, Nội dung, Ghi chú. Điền trong Excel rồi nhập lại. Khớp theo Ngày (chấp nhận YYYY-MM-DD hoặc DD/MM/YYYY); dòng trống nội dung và ghi chú được bỏ qua; ô ghi chú để trống thì giữ nguyên ghi chú hiện có (không bị xóa); kiểm tra thử trước khi ghi.
- **Gợi ý nội dung bằng AI** (cần `GEMINI_API_KEY`): trong khung dán nội dung hàng loạt, nút "Gợi ý bằng AI" điền danh sách nội dung theo cấp độ và giáo trình của lớp. Server không lưu gì; giáo viên đọc lại, sửa, rồi mới bấm "Gán nội dung". Lỗi AI báo 503, không bao giờ điền nội dung giả.
- Quyền: chỉ admin tạo và sửa lịch, ngày nghỉ. Giáo viên xem lịch lớp mình phụ trách, học viên xem lịch lớp đang học. Tổng quan hiện nội dung buổi hôm nay; cổng học viên hiện các buổi sắp tới.

## Nhập / xuất học viên bằng CSV

- **Xuất:** nút "Xuất CSV" trên màn hình Học viên, xuất theo lớp đang lọc (hoặc tất cả trong phạm vi quyền). Giáo viên chỉ xuất học viên lớp mình phụ trách. Ô bắt đầu bằng `= + - @` được thêm `'` phía trước để Excel không chạy công thức. Mỗi lần xuất được ghi `audit_logs`.
- **Nhập:** nút "Nhập CSV". Chọn file, server kiểm tra từng dòng trước (email trùng, lớp không tồn tại hoặc không phụ trách, giới tính, ngày), không ghi gì. Bấm nhập thì chỉ dòng hợp lệ được ghi, trong một transaction, tối đa 200 dòng mỗi lần.
- Tên cột nhận tiếng Việt có hoặc không dấu, hoặc tiếng Anh. Dấu phân cách `,` hoặc `;` được nhận tự động. Email để trống sẽ tự sinh `student.<mã>@eduscan.edu.vn`.
- Học viên nhập hàng loạt được đặt `must_change_password`. Mật khẩu tạm chỉ trả về một lần và được tải thành file CSV, không lưu ở đâu khác.

## Đăng ký học thử từ website (leads)

- `POST /api/leads/public` (công khai, không cần đăng nhập): website gửi JSON `{ fullName, phone, currentLevel, targetJlpt, notes, source, consent: true }` và nhận `{ ok: true }`. Số điện thoại được chuẩn hóa về dạng `0xxxxxxxxx`; thiếu họ tên, số sai hoặc `consent` khác `true` thì trả 400.
- Chống lạm dụng: giới hạn 10 lần/giờ theo IP, body tối đa 8KB, ô ẩn `website` (bot điền thì trả OK nhưng không lưu), cùng số điện thoại trong 24 giờ không tạo bản ghi trùng.
- Cần đặt `CORS_ORIGIN` gồm domain website (VD `https://imejiquynhon.com`) để trình duyệt được gọi từ site khác.
- Admin: `GET /api/leads?status=` và `PATCH /api/leads/:id` (`status`: `new`, `contacted`, `trial`, `enrolled`, `declined`; `admin_note`). Mỗi lần sửa ghi `audit_logs`.
- **Màn hình "Đăng ký"** (chỉ admin, đường dẫn `/leads`): danh sách theo trạng thái, gọi/Zalo nhanh, đổi trạng thái và ghi chú xử lý. Tab có huy hiệu số đăng ký còn ở trạng thái "Mới".
- **Email báo đăng ký mới:** cần `RESEND_API_KEY` và `MAIL_FROM` (cùng cấu hình với email đặt lại mật khẩu). Người nhận là `LEADS_NOTIFY_EMAIL` (nhiều địa chỉ cách nhau dấu phẩy), nếu bỏ trống thì gửi cho các admin đang hoạt động. Đặt `APP_URL` (địa chỉ eduscan) để email có liên kết mở danh sách. Gửi email lỗi chỉ ghi log, không ảnh hưởng việc nhận đăng ký.
- **Ghi danh từ đăng ký:** nút "Tạo học viên và ghi danh" (`POST /api/leads/:id/convert`, chỉ admin; body `class_id`, tùy chọn `email`, `join_date`) tạo tài khoản học viên bằng họ tên và số điện thoại của đăng ký, ghi danh vào lớp, tạo học phí tháng hiện tại, đánh dấu "Đã ghi danh" và hiện mật khẩu tạm một lần. Mỗi đăng ký chỉ tạo được một lần (cột `leads.student_id`, hai lần bấm cùng lúc thì lần sau nhận 409). Không nhập email thì tên đăng nhập tự sinh `student.<mã>@eduscan.edu.vn`.
- Bảng `leads` nằm trong "Sao lưu/Phục hồi" JSON (dữ liệu CRM không thể tái tạo), nên phục hồi sẽ thay thế cả danh sách đăng ký. `password_resets` và `audit_logs` cố ý không được sao lưu.

## Lịch khai giảng công khai cho website

- `GET /api/public/classes` (công khai, chỉ đọc, 60 yêu cầu/phút/IP, cache 5 phút): trả `next_start_date` (ngày khai giảng gần nhất), `weekdays` (các thứ học, 0 = Chủ Nhật ... 6 = Thứ Bảy) và danh sách lớp sắp khai giảng gồm `level`, `start_date`, `weekdays`, `start_time`, `end_time`.
- Chỉ lấy lớp có **Ngày bắt đầu** từ hôm nay trở đi. Không có tên lớp, giáo viên, phòng, học phí hay học viên. Muốn website hiện ngày khai giảng mới, chỉ cần đặt ngày bắt đầu và lịch lặp cho lớp (nút **Lịch** trên thẻ lớp).
- Website (imejiquynhon.com) đọc endpoint này lúc người xem mở trang; khi eduscan chậm hoặc chưa có lớp sắp khai giảng thì dùng giá trị mặc định trong `siteInfo.ts`.

## Sao lưu

- **Lớp chính:** sao lưu tự động của Supabase (gói có sao lưu hằng ngày/PITR). Kiểm tra gói đang dùng có bật tính năng này.
- **Lớp bổ sung:** workflow `.github/workflows/backup.yml` chạy `pg_dump` hằng ngày, cần secret `SUPABASE_DB_URL`.
- **Sao lưu thủ công:** admin bấm "Sao lưu" trên thanh công cụ để tải file JSON. File này chứa băm mật khẩu, cần cất giữ như dữ liệu nhạy cảm. "Phục hồi" thay thế toàn bộ dữ liệu và yêu cầu xác nhận.

## Bảo mật đã áp dụng

- Mật khẩu băm bằng scrypt; đăng nhập bị giới hạn theo IP và theo tài khoản (10 lần sai / 15 phút).
- Mọi API cần token JWT; quyền được kiểm tra lại trong cơ sở dữ liệu ở mỗi request, nên tài khoản bị khóa mất quyền ngay.
- Học viên chỉ truy cập dữ liệu của chính mình; route ghi chỉ dành cho giáo viên/admin.
- Production bắt buộc `JWT_SECRET` và `APP_URL`; không có mật khẩu mặc định trong môi trường production.
- Đăng ký công khai bị giới hạn 10 lần/giờ/IP và mật khẩu tối thiểu 8 ký tự. Đặt `REGISTRATION_MODE=invite` (kèm `REGISTRATION_INVITE_CODE`) hoặc `REGISTRATION_MODE=closed` để chỉ người có mã mời mới tạo được tài khoản, hoặc đóng hoàn toàn.
- AI không bao giờ trả điểm hay nhận xét giả khi lỗi; giáo viên luôn duyệt kết quả trước khi lưu.

## Quy tắc nghiệp vụ

- **Học phí:** trạng thái `unpaid`, `partial` (đóng một phần) hoặc `paid`. Số nợ = `amount - paid_amount` của hồ sơ chưa đóng đủ; số đã thu tính theo `paid_amount`. Màn hình học phí, Tổng quan và Thống kê dùng chung quy tắc này (`src/shared/utils/tuition.ts`), khoản `partial` hiện ở bộ lọc "Chưa đóng". `POST /api/tuition/payment` thu thiếu số tiền học phí thì ghi `partial`; gọi lại trên hồ sơ đã đóng đủ mà không truyền số tiền thì giữ nguyên ngày đóng và ghi chú; hồ sơ mới không truyền số tiền lấy học phí của lớp.
- **Cổng học viên tải dữ liệu theo vai trò:** học viên tải học phí của chính mình (`/api/tuition` tự lọc) và không gọi `/api/students` (chỉ giáo viên/admin, trả 403 và làm hiện banner "Không tải được một phần dữ liệu"); giáo viên không tải học phí. Cờ `isStudent`/`isAdmin` truyền vào `useEcosystemData`.
- **Bài tập và chấm bài:** mọi giáo viên/admin xem được bài tập và bài nộp của mọi lớp và chấm, ghi nhận bài nộp, tạo bản nháp AI cho mọi lớp; chỉ giao hoặc xóa bài thì phải phụ trách lớp đó. `GET /api/classes/:id/roster` trả danh sách học viên đang học (chỉ id, họ tên, mã số, không có SĐT/email) để chấm bài lớp không phụ trách.
- **Thông báo:** chỉ gửi khi giao bài, chấm điểm và khi học viên được xếp vào lớp (kể cả tạo mới, nhập CSV, chuyển từ đăng ký thử). Cố ý không gửi khi thu học phí hay đổi/hủy buổi học.
- **Làm mới dữ liệu tự động:** dữ liệu được tải lúc đăng nhập, rồi tự làm mới âm thầm khi quay lại tab/ứng dụng và mỗi 2 phút khi đang mở (chỉ khi dữ liệu cũ hơn 1 phút), để admin, giáo viên và học viên thấy thay đổi của nhau (học phí vừa thu, bài mới giao, điểm vừa chấm) mà không cần tải lại trang. Danh sách điểm danh giữ nguyên tham chiếu khi không đổi để không ghi đè ô tick dở của điểm danh nhanh.
- **Học viên chưa xếp lớp** (tự đăng ký hoặc tạo không kèm lớp): giáo viên thấy họ trong danh sách Học viên và chỉ được xếp vào lớp mình phụ trách (`PUT /api/students/:id` chỉ với `class_id`, và tùy chọn `join_date`); mọi sửa đổi khác vẫn cần là admin hoặc học viên đã thuộc lớp mình. Nút **Thêm HV** trên thẻ lớp (Quản lý lớp) mở danh sách học viên có sẵn để chọn, thay vì phải nhập tay; học viên đang học lớp khác sẽ được chuyển sang lớp này.
- **Chuyên cần:** một học viên có thể có cả bản ghi phiên QR lẫn phiên điểm danh nhanh trong cùng ngày. Thống kê gộp theo (học viên, lớp, ngày) và ưu tiên có mặt > đi muộn > có phép > vắng (`src/shared/utils/attendance.ts`), nên buổi học không bị đếm hai lần. Đi muộn và có phép không được tính là có mặt khi tính tỷ lệ chuyên cần.
- **Nộp lại bài:** xóa điểm, nhận xét, barem, điểm mạnh/yếu, gợi ý và bản nháp AI của lần nộp trước.
- **Sửa học viên (`PUT /api/students/:id`):** họ tên không được rỗng (tối đa 150 ký tự), `status` chỉ nhận `active`, `suspended`, `inactive`; giá trị `null` của SĐT/ảnh đại diện được lưu là chuỗi rỗng.
- **Mã học viên tự sinh** (`STU` + 6 chữ số) được kiểm tra không trùng mã đang có (`server/lib/studentCode.ts`). Cột `student_code` không có unique index nên mã nhập tay vẫn có thể trùng.
- **Xung đột đồng thời:** đăng ký trùng email, chuyển buổi học sang ngày đã có buổi, đổi tháng học phí sang tháng đã có hồ sơ đều trả 409 (bắt lỗi unique `23505`, `server/lib/dbErrors.ts`) thay vì 500.
- **Nhập CSV học viên:** chỉ dòng hợp lệ mới giữ chỗ email; dòng lỗi không làm dòng sau bị báo trùng.
- **Nộp lại bài** xóa luôn tệp đính kèm cũ khỏi Storage (lỗi xóa chỉ ghi log). Bộ đếm đăng nhập sai tự dọn khóa hết hạn khi vượt 1000 mục.
- **Thông báo bài tập mới** ghi hạn nộp theo múi giờ `APP_TZ`, không phải UTC.

## Giới hạn đã biết

- Khi đổi tên cột hoặc quy tắc tính tiền, nhớ cập nhật cả `tests/api/logic-fixes.test.ts` và `tests/unit/tuition-attendance-utils.test.ts`.

- Giao diện đã bỏ điểm danh bằng QR (giáo viên điểm danh nhanh); API QR bên dưới vẫn còn ở server nhưng không còn màn hình nào dùng.
- Mã QR do server ký (HMAC-SHA256, khóa suy ra từ `JWT_SECRET`), đổi mỗi 15 giây, gắn với đúng một phiên và chấp nhận thêm chu kỳ liền trước. Học viên không thể tự dựng mã, nhưng vẫn có thể chụp màn hình gửi cho bạn đang ở xa trong tối đa 30 giây. Đổi `JWT_SECRET` thì mã đang hiển thị mất hiệu lực (giáo viên chỉ cần chờ chu kỳ kế tiếp).
- Mã phiên nhập tay (`ES-xxxx`) dùng cho học viên không có camera và không đổi trong suốt phiên, nên ai nhìn thấy trên màn chiếu cũng có thể gửi đi. Phiên được đóng khi giáo viên tắt màn hình QR Live (hoặc mở phiên mới), sau đó mã nhập tay không dùng được nữa. Nếu cần chặt hơn, hãy tắt QR Live ngay khi bắt đầu giờ học.
- RLS bật trên mọi bảng (migration 0002) và không có policy: Data API của Supabase (anon/authenticated) không đọc được dữ liệu; server dùng role postgres nên không bị ảnh hưởng.
