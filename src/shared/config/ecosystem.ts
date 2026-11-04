// Địa chỉ và liên hệ dùng chung của hệ sinh thái IMEJI日本語教室: website (imeji_newhorizon),
// trang luyện tập (imeji_dominion, chạy ở /luyen-tap/ của website) và cổng học viên (app này).

/** Website chính; trang luyện tập Minna chạy ở WEBSITE_URL/luyen-tap/. Đổi bằng VITE_MINNA_ORIGIN. */
export const WEBSITE_URL = ((import.meta.env.VITE_MINNA_ORIGIN as string | undefined) || 'https://imejiquynhon.com').replace(/\/+$/, '');
export const PRACTICE_URL = `${WEBSITE_URL}/luyen-tap/`;

export const PHONE = '0868608647';
export const PHONE_DISPLAY = '086 860 8647';
export const ZALO_URL = `https://zalo.me/${PHONE}`;
export const EMAIL = 'lienhe@imejiquynhon.com';
export const ADDRESS = '80 Võ Mười, P. Quy Nhơn Nam, Gia Lai';
