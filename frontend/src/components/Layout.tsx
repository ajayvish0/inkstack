import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMe, useSignOut } from "../lib/queries";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";

function SearchBox() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [value, setValue] = useState(params.get("q") ?? "");
  useEffect(() => setValue(params.get("q") ?? ""), [params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  return (
    <form role="search" onSubmit={submit} className="hidden sm:block">
      <label htmlFor="site-search" className="sr-only">
        Search posts
      </label>
      <input
        id="site-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search posts"
        className="w-56 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm placeholder:text-slate-400 focus:bg-white"
      />
    </form>
  );
}

function UserMenu() {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!me) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/signin" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Sign in
        </Link>
        <Link to="/signup" className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-800">
          Start writing
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/new"
        className="hidden rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:inline-flex"
      >
        Write
      </Link>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="rounded-full"
        >
          <Avatar name={me.name} />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-4 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{me.name}</p>
              <p className="truncate text-xs text-slate-500">{me.email}</p>
            </div>
            <Link role="menuitem" to="/new" className="block px-4 py-2 text-sm hover:bg-slate-50 sm:hidden">
              Write a post
            </Link>
            <Link role="menuitem" to="/me" className="block px-4 py-2 text-sm hover:bg-slate-50">
              Your posts & profile
            </Link>
            <Link role="menuitem" to={`/u/${me.id}`} className="block px-4 py-2 text-sm hover:bg-slate-50">
              Public profile
            </Link>
            <button
              role="menuitem"
              type="button"
              className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate("/") })}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" aria-label="Inkstack home">
              <Logo />
            </Link>
            <SearchBox />
          </div>
          <UserMenu />
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Inkstack — a writing platform for developers.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <NavLink to="/" className="hover:text-slate-800">
              Feed
            </NavLink>
            <NavLink to="/new" className="hover:text-slate-800">
              Write
            </NavLink>
            <a href="/api/v1/health" className="hover:text-slate-800">
              Status
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
