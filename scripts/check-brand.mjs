// So bộ quy chuẩn thương hiệu (imeji-brand.css) của repo này với bản gốc trong imeji_newhorizon trên GitHub.
// Lệch thì báo lỗi; không có mạng thì chỉ cảnh báo. Đổi nguồn bằng BRAND_SOURCE_URL.
import fs from "node:fs";
import path from "node:path";

const LOCAL = "src/styles/imeji-brand.css";
const SOURCE =
  process.env.BRAND_SOURCE_URL ??
  "https://raw.githubusercontent.com/miyagitaisuki/imeji_newhorizon/main/src/styles/imeji-brand.css";

const local = fs.readFileSync(path.resolve(import.meta.dirname, "..", LOCAL), "utf8");
let remote;
try {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  remote = await res.text();
} catch (err) {
  console.warn(`Cảnh báo: không tải được bản gốc (${err.message}), bỏ qua kiểm tra.`);
  process.exit(0);
}
if (remote.replace(/\r\n/g, "\n") === local.replace(/\r\n/g, "\n")) {
  console.log(`${LOCAL} khớp bản gốc.`);
} else {
  console.error(`${LOCAL} KHÁC bản gốc ${SOURCE}. Chép y nguyên bản gốc vào đây (hoặc cập nhật bản gốc trước).`);
  process.exit(1);
}
