import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PASSWORD_MIN, signinInput, signupInput } from "@inkstack/common";
import { Logo } from "../components/Logo";
import { Alert, Button, TextField } from "../components/ui";
import { ApiError, errorMessage } from "../lib/api";
import { useMe, useSignIn, useSignUp } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type FieldErrors = Record<string, string | undefined>;

// Only follow same-site relative paths after sign-in (no open redirects).
function useNextPath() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function firstErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function fromApi(err: unknown): FieldErrors {
  if (!(err instanceof ApiError) || !err.fields) return {};
  return Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]]));
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-ink-50 to-white px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" aria-label="Inkstack home" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 font-serif text-3xl text-ink-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function SignIn() {
  useDocumentTitle("Sign in");
  const { data: me } = useMe();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const next = useNextPath();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = signinInput.safeParse(form);
    if (!parsed.success) return setErrors(firstErrors(parsed.error.issues));
    setErrors({});
    signIn.mutate(parsed.data, { onSuccess: () => navigate(next, { replace: true }) });
  };

  const apiErrors = fromApi(signIn.error);
  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to Inkstack?{" "}
          <Link to={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {signIn.isError && !Object.keys(apiErrors).length && <Alert>{errorMessage(signIn.error)}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email ?? apiErrors.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password ?? apiErrors.password}
          required
        />
        <Button type="submit" className="w-full" loading={signIn.isPending}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  useDocumentTitle("Create an account");
  const { data: me } = useMe();
  const signUp = useSignUp();
  const navigate = useNavigate();
  const next = useNextPath();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = signupInput.safeParse(form);
    if (!parsed.success) return setErrors(firstErrors(parsed.error.issues));
    setErrors({});
    signUp.mutate(parsed.data, { onSuccess: () => navigate(next === "/" ? "/new" : next, { replace: true }) });
  };

  const apiErrors = fromApi(signUp.error);
  return (
    <AuthShell
      title="Start writing on Inkstack"
      subtitle={
        <>
          Already have an account?{" "}
          <Link to={`/signin${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {signUp.isError && !Object.keys(apiErrors).length && <Alert>{errorMessage(signUp.error)}</Alert>}
        <TextField
          label="Name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name ?? apiErrors.name}
          required
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email ?? apiErrors.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password ?? apiErrors.password}
          hint={`At least ${PASSWORD_MIN} characters.`}
          required
        />
        <Button type="submit" className="w-full" loading={signUp.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
