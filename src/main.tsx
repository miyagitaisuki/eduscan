import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ConfirmProvider, IssuedPasswordProvider } from './shared/components/ui';
// Font thương hiệu tự host (CSP production chặn Google Fonts; PWA vẫn có font khi mất mạng)
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/be-vietnam-pro/900.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ConfirmProvider>
    <IssuedPasswordProvider>
      <App />
    </IssuedPasswordProvider>
  </ConfirmProvider>
);
