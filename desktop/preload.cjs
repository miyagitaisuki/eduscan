// Chỉ trang trạng thái cục bộ (file://) có nút "Thử lại"; trang EduScan từ máy chủ không nhận API nào
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('eduscanDesktop', {
    retry: () => ipcRenderer.send('eduscan:retry'),
  });
}
