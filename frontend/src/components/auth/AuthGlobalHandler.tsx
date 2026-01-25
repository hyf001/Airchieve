import { useEffect } from 'react';
import { useAuth, setGlobalOpenLoginModal } from '@/context/AuthContext';
import { LoginModal } from './LoginModal';

export function AuthGlobalHandler() {
  const { openLoginModal } = useAuth();

  useEffect(() => {
    setGlobalOpenLoginModal(openLoginModal);
    return () => {
      setGlobalOpenLoginModal(() => {});
    };
  }, [openLoginModal]);

  return <LoginModal />;
}
