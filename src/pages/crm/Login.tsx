import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { CrmThemeProvider, useCrmTheme } from '../../components/crm/CrmThemeProvider';
import { Button, ErrorState, Field } from '../../components/crm/ui';

const CONTROL =
  'h-10 w-full rounded-crm-md border border-crm-line bg-crm-ground px-3 text-[14px] text-crm-ink ' +
  'placeholder:text-crm-faint transition-colors duration-150 ease-crm ' +
  'hover:border-crm-line-hi focus:border-crm-copper';

const LoginForm = () => {
  const { signIn, session } = useAuth();
  const { theme } = useCrmTheme();
  const navigate = useNavigate();
  const location = useLocation();
  /* Where ProtectedRoute wanted to send them, if anything. */
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from.startsWith('/crm') ? from : '/crm';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate(destination, { replace: true });
  }, [session, navigate, destination]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else navigate(destination, { replace: true });
  };

  return (
    <div
      className="crm-root flex min-h-screen items-center justify-center px-6 py-12"
      data-crm-theme={theme}
    >
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap"
        />
      </Helmet>

      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-crm-lg bg-crm-copper font-crm-display text-[22px] font-bold leading-none text-crm-copper-ink">
            X
          </span>
          <h1 className="m-0 font-crm-display text-[21px] font-bold tracking-[-0.02em] text-crm-ink">
            Xtenzium CRM
          </h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-crm-ink-3">
            Clients, projects and everything owed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email" required>
            {({ id }) => (
              <input
                id={id}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@xtenzium.com"
                className={CONTROL}
              />
            )}
          </Field>

          <Field label="Password" required>
            {({ id }) => (
              <input
                id={id}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={CONTROL}
              />
            )}
          </Field>

          {error && (
            <ErrorState
              title="That sign-in didn’t go through"
              body={error}
            />
          )}

          <Button type="submit" variant="primary" loading={loading} className="mt-1 h-10 w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
};

const Login = () => (
  <CrmThemeProvider>
    <LoginForm />
  </CrmThemeProvider>
);

export default Login;
