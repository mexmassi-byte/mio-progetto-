import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router-dom";
import { HASH_ROUTING } from "./lib/env";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/500.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "./styles/main.css";
import "./lib/gsap";
import App from "./App";
import Home from "./pages/Home";
import About from "./pages/About";
import Expertise from "./pages/Expertise";
import Team from "./pages/Team";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import { Imprint, Privacy } from "./pages/Legal";
import { LangProvider } from "./lib/i18n";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const router = (HASH_ROUTING ? createHashRouter : createBrowserRouter)([
  {
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/about", element: <About /> },
      { path: "/expertise", element: <Expertise /> },
      { path: "/team", element: <Team /> },
      { path: "/contact", element: <Contact /> },
      { path: "/imprint", element: <Imprint /> },
      { path: "/privacy", element: <Privacy /> },
      { path: "*", element: <NotFound /> },
    ],
  },
], {
  future: { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true },
});

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </LangProvider>,
);
