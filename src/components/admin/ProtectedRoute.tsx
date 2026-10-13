import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homeFor, roleAllowed } from '../../lib/roles';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  /* Roles that may see this route. Defaults to admin-only: a route has
     to opt IN to being visible to a caller, not out. */
  allow?: readonly UserRole[];
}

/* A login with no profile row. Not an error in the app — it's what
   migration 016 means by "no access" — so say so plainly. */
const NoAccess = () => {
  const { user, signOut } = useAuth();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24,
    }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>No access yet</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#a3a3a3', margin: '0 0 20px' }}>
          {user?.email} is signed in, but hasn’t been given a role. Ask an admin to set you up.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #333', background: 'transparent', color: '#fff', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/admin/login',
  allow = ['admin'],
}) => {
  const { session, loading, role } = useAuth();
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

  if (!roleAllowed(role, allow)) {
    return role === null ? <NoAccess /> : <Navigate to={homeFor(role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
