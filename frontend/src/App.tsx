import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { NotFoundState } from "./components/States";
import { Spinner } from "./components/ui";
import Home from "./pages/Home";
import { SignIn, SignUp } from "./pages/Auth";

// The post page and editor pull in the markdown/highlighting stack, so they
// load on demand instead of in the first bundle.
const PostPage = lazy(() => import("./pages/PostPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewPost = lazy(() => import("./pages/Editor").then((m) => ({ default: m.NewPost })));
const EditPost = lazy(() => import("./pages/Editor").then((m) => ({ default: m.EditPost })));

const page = (node: ReactNode) => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    }
  >
    {node}
  </Suspense>
);

// A data router is required for useBlocker (the editor's unsaved-changes guard).
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/p/:slug", element: page(<PostPage />) },
      { path: "/u/:id", element: page(<Profile />) },
      { path: "/new", element: page(<RequireAuth><NewPost /></RequireAuth>) },
      { path: "/edit/:slug", element: page(<RequireAuth><EditPost /></RequireAuth>) },
      { path: "/me", element: page(<RequireAuth><Dashboard /></RequireAuth>) },
      { path: "/signin", element: <SignIn /> },
      { path: "/signup", element: <SignUp /> },
      { path: "*", element: <NotFoundState /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
