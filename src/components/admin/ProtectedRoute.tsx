import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectTo = '/admin/login' }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32,
            height: 32,
            border: '2px solid #333',
            borderTop: '2px solid #ffffff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!session) {
    /* Carry where they were trying to go, query string included. A
       shared view link is mostly URL — dropping it here would send
       someone who signs in to the dashboard instead of the view they
       were sent, which is the whole point of shareable views. */
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={redirectTo} replace state={{ from }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
