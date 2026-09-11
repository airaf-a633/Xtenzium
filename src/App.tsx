import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';


// Context
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';

// ─── Lazy admin pages ──────────────────────────────────────────────────────
const Login       = lazy(() => import('./pages/admin/Login'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard   = lazy(() => import('./pages/admin/Dashboard'));
const Leads       = lazy(() => import('./pages/admin/leads/Leads'));
const LeadDetail  = lazy(() => import('./pages/admin/leads/LeadDetail'));
const AdminBlogs  = lazy(() => import('./pages/admin/blogs/Blogs'));
const BlogEdit    = lazy(() => import('./pages/admin/blogs/BlogEdit'));

// ─── Lazy CRM pages ────────────────────────────────────────────────────────
const CrmLogin       = lazy(() => import('./pages/crm/Login'));
const CrmLayout       = lazy(() => import('./pages/crm/CrmLayout'));
const CrmDashboard    = lazy(() => import('./pages/crm/Dashboard'));
const CrmAnalytics    = lazy(() => import('./pages/crm/Analytics'));
const CrmTestimonials = lazy(() => import('./pages/crm/Testimonials'));
const Pipeline        = lazy(() => import('./pages/crm/pipeline/Pipeline'));
const MyWork          = lazy(() => import('./pages/crm/MyWork'));
const CrmSettings     = lazy(() => import('./pages/crm/Settings'));
const Clients         = lazy(() => import('./pages/crm/clients/Clients'));
const ClientDetail    = lazy(() => import('./pages/crm/clients/ClientDetail'));
const Projects        = lazy(() => import('./pages/crm/projects/Projects'));
const ProjectDetail   = lazy(() => import('./pages/crm/projects/ProjectDetail'));
const ImportCsv       = lazy(() => import('./pages/crm/projects/ImportCsv'));
const Tasks           = lazy(() => import('./pages/crm/tasks/Tasks'));
const Team            = lazy(() => import('./pages/crm/team/Team'));

// ─── Minimal fallback shown while chunks load ──────────────────────────────
const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

/*
 * There is no public app here any more. The marketing site is the Astro
 * app in web/, served from /; this bundle is built with base /crm/ and
 * only ever sees /crm and /admin paths. The React marketing pages that
 * used to live alongside were unreachable dead weight — 900 kB of it in
 * the Home chunk alone — and are gone.
 */

// ─── Route splitter — decides admin vs crm vs public ───────────────────────
const AppRoutes = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isCrm = location.pathname.startsWith('/crm');

  if (isAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index         element={<Dashboard />} />
            <Route path="leads"  element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="blogs"  element={<AdminBlogs />} />
            <Route path="blogs/new" element={<BlogEdit />} />
            <Route path="blogs/:id" element={<BlogEdit />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  if (isCrm) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/crm/login" element={<CrmLogin />} />
          <Route
            path="/crm"
            element={
              <ProtectedRoute redirectTo="/crm/login">
                <CrmLayout />
              </ProtectedRoute>
            }
          >
            <Route index                element={<CrmDashboard />} />
            <Route path="my-work"       element={<MyWork />} />
            <Route path="analytics"     element={<CrmAnalytics />} />
            <Route path="testimonials"  element={<CrmTestimonials />} />
            <Route path="settings"      element={<CrmSettings />} />
            <Route path="pipeline"      element={<Pipeline />} />
            <Route path="clients"       element={<Clients />} />
            <Route path="clients/new"   element={<ClientDetail />} />
            <Route path="clients/:id"   element={<ClientDetail />} />
            <Route path="projects"        element={<Projects />} />
            <Route path="projects/new"    element={<ProjectDetail />} />
            <Route path="projects/import" element={<ImportCsv />} />
            <Route path="projects/:id"    element={<ProjectDetail />} />
            <Route path="tasks"         element={<Tasks />} />
            <Route path="team"          element={<Team />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  return <Navigate to="/crm" replace />;
};

// ─── Root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
