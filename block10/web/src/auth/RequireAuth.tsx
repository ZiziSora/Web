import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { bootstrapAuth } from './state';
import { State } from '../components/State';
export function RequireAuth() {
  const auth = useAuth();
  if (auth.status === 'loading') return <State loading retry={() => {}} />;
  if (auth.status === 'error') return <State loading={false} error={auth.error ?? undefined} retry={() => { void bootstrapAuth(true); }} />;
  return auth.user ? <Outlet /> : <Navigate to="/login" replace />;
}
