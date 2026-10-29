// Thu nhỏ và nén ảnh ngay trên trình duyệt trước khi gửi, để ảnh chụp từ điện thoại không vượt giới hạn tệp.
// Tệp không phải ảnh (PDF, DOCX) hoặc ảnh không giải mã được thì trả về nguyên bản.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadImage(file);
  } catch {
    return file;
  }

  const width = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const height = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // Nền trắng để PNG trong suốt không thành đen khi chuyển sang JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh'));
    };
    img.src = url;
  });
}
