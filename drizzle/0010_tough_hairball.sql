-- Dọn dữ liệu trùng trước khi thêm ràng buộc duy nhất.
-- Học phí: mỗi học viên/tháng giữ hồ sơ "đầy đủ" nhất (đã đóng > số tiền đã đóng lớn hơn > id).
DELETE FROM "tuition_records" t
USING (
  SELECT id, row_number() OVER (
    PARTITION BY student_id, month
    ORDER BY (status = 'paid') DESC, paid_amount DESC, id DESC
  ) AS rn
  FROM "tuition_records"
) d
WHERE t.id = d.id AND d.rn > 1;--> statement-breakpoint
-- Phiên điểm danh: chỉ cần mã duy nhất giữa các phiên đang mở. Phiên trùng mã được cấp
-- mã mới sinh từ khóa chính (19 ký tự, không đụng định dạng ES-xxxx của mã thường).
UPDATE "attendance_sessions" s
SET "session_code" = 'ES-' || substr(md5(s.id), 1, 16)
WHERE s.is_active AND s.id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY session_code
      ORDER BY start_time, id
    ) AS rn
    FROM "attendance_sessions"
    WHERE is_active
  ) d
  WHERE d.rn > 1
);--> statement-breakpoint
DROP INDEX "idx_sessions_code";--> statement-breakpoint
DROP INDEX "idx_tuition_student_month";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_session_code" ON "attendance_sessions" USING btree ("session_code") WHERE "attendance_sessions"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_tuition_student_month" ON "tuition_records" USING btree ("student_id","month");
