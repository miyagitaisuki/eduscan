import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ConfirmProvider, IssuedPasswordProvider } from './shared/components/ui';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ConfirmProvider>
    <IssuedPasswordProvider>
      <App />
    </IssuedPasswordProvider>
  </ConfirmProvider>
);
