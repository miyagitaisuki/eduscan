import React, { createContext, useCallback, useContext, useState } from 'react';
import { TempPasswordModal } from './TempPasswordModal';
import type { Credentials } from '../../utils/credentials';

type ShowFn = (credentials: Credentials) => void;

const IssuedPasswordContext = createContext<ShowFn | null>(null);

// Hiển thị mật khẩu tạm vừa được cấp. Đặt ở cấp ứng dụng (cùng chỗ với ConfirmProvider) nên hộp thoại
// không mất khi người dùng chuyển trang hoặc bấm Back, và mọi luồng cấp mật khẩu dùng chung một giao diện.
export const IssuedPasswordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const show = useCallback<ShowFn>((next) => setCredentials(next), []);

  return (
    <IssuedPasswordContext.Provider value={show}>
      {children}
      {credentials && <TempPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </IssuedPasswordContext.Provider>
  );
};

export function useIssuedPassword(): ShowFn {
  const show = useContext(IssuedPasswordContext);
  if (!show) throw new Error('useIssuedPassword phải được dùng bên trong <IssuedPasswordProvider>.');
  return show;
}
