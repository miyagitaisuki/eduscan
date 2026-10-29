// Ứng dụng desktop EduScan: một cửa sổ Electron mở máy chủ EduScan đã deploy (giống Zalo PC gọi về server Zalo).
// App không chứa mật khẩu database hay khóa bí mật nào: mọi dữ liệu và phân quyền nằm ở máy chủ.
const { app, BrowserWindow, Menu, ipcMain, net, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SERVER_URL = 'https://eduscan-28hk.onrender.com';
// Render gói miễn phí ngủ khi vắng truy cập, đánh thức mất khoảng 30-60 giây
const WAKE_TIMEOUT_MS = 120_000;
const HEALTH_REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_RETRY_DELAY_MS = 3_000;
// Quyền trình duyệt cấp cho trang EduScan: camera quét QR, sao chép thông tin đăng nhập, toàn màn hình
const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write', 'fullscreen']);
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// Địa chỉ máy chủ: biến môi trường EDUSCAN_URL, rồi serverUrl trong config.json ở thư mục dữ liệu app, rồi mặc định
function resolveServerOrigin() {
  let configured = process.env.EDUSCAN_URL;
  if (!configured) {
    try {
      const file = path.join(app.getPath('userData'), 'config.json');
      configured = JSON.parse(fs.readFileSync(file, 'utf8')).serverUrl;
    } catch {
      // Không có hoặc hỏng config.json thì dùng mặc định
    }
  }
  try {
    return new URL(configured || DEFAULT_SERVER_URL).origin;
  } catch {
    return new URL(DEFAULT_SERVER_URL).origin;
  }
}

let serverOrigin;
let mainWindow = null;
// Mỗi lần kết nối có số thứ tự riêng, để lần thử cũ không ghi đè lần mới (VD bấm "Thử lại" khi đang chờ)
let connectAttempt = 0;

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isServerUrl(url) {
  return originOf(url) === serverOrigin;
}

function openExternal(url) {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) shell.openExternal(url);
  } catch {
    // URL không hợp lệ thì bỏ qua
  }
}

function showStatus(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, 'pages', 'status.html'), {
    query: { state, server: serverOrigin },
  });
}

async function serverIsUp() {
  try {
    const res = await net.fetch(`${serverOrigin}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Hiện màn hình chờ, gọi /api/health tới khi máy chủ thức rồi mới mở app; quá thời gian thì hiện màn hình mất kết nối
async function connect() {
  const attempt = ++connectAttempt;
  showStatus('loading');
  const deadline = Date.now() + WAKE_TIMEOUT_MS;
  while (attempt === connectAttempt) {
    if (await serverIsUp()) {
      if (attempt === connectAttempt && mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(serverOrigin);
      return;
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, HEALTH_RETRY_DELAY_MS));
  }
  if (attempt === connectAttempt) showStatus('offline');
}

function reload() {
  if (!mainWindow) return;
  if (isServerUrl(mainWindow.webContents.getURL())) mainWindow.webContents.reload();
  else connect();
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'EduScan',
      submenu: [
        { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', click: reload },
        { label: 'Về trang chính', accelerator: 'Alt+Home', click: () => connect() },
        { type: 'separator' },
        { label: 'Thoát', role: 'quit' },
      ],
    },
    {
      label: 'Chỉnh sửa',
      submenu: [
        { label: 'Hoàn tác', role: 'undo' },
        { label: 'Làm lại', role: 'redo' },
        { type: 'separator' },
        { label: 'Cắt', role: 'cut' },
        { label: 'Sao chép', role: 'copy' },
        { label: 'Dán', role: 'paste' },
        { label: 'Chọn tất cả', role: 'selectAll' },
      ],
    },
    {
      label: 'Hiển thị',
      submenu: [
        { label: 'Phóng to', role: 'zoomIn' },
        { label: 'Thu nhỏ', role: 'zoomOut' },
        { label: 'Cỡ mặc định', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toàn màn hình', role: 'togglefullscreen' },
        { label: 'Công cụ nhà phát triển', role: 'toggleDevTools' },
      ],
    },
  ]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: 'EduScan',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const { webContents } = mainWindow;

  // Chỉ điều hướng trong máy chủ EduScan; liên kết ngoài mở bằng trình duyệt mặc định
  const guardNavigation = (event, url) => {
    if (isServerUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  };
  webContents.on('will-navigate', guardNavigation);
  webContents.on('will-redirect', guardNavigation);

  // F5 tải lại như trình duyệt
  webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault();
      reload();
    }
  });

  // Không mở cửa sổ con. window.open('') trả null nên app tự gọi lại với URL thật (VD tệp đính kèm), URL đó mở ngoài
  webContents.setWindowOpenHandler(({ url }) => {
    if (url && url !== 'about:blank') openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    // -3 (ABORTED): điều hướng bị thay bằng điều hướng khác, không phải lỗi mạng
    if (isMainFrame && errorCode !== -3 && isServerUrl(validatedUrl)) showStatus('offline');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    connectAttempt++;
  });

  connect();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    serverOrigin = resolveServerOrigin();
    if (process.platform === 'win32') app.setAppUserModelId('vn.edu.eduscan.desktop');

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      callback(originOf(details.requestingUrl) === serverOrigin && ALLOWED_PERMISSIONS.has(permission));
    });
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
      return originOf(requestingOrigin) === serverOrigin && ALLOWED_PERMISSIONS.has(permission);
    });

    // Nút "Thử lại" chỉ được gọi từ trang trạng thái cục bộ
    ipcMain.on('eduscan:retry', (event) => {
      if (event.senderFrame && event.senderFrame.url.startsWith('file:')) connect();
    });

    Menu.setApplicationMenu(buildMenu());
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
