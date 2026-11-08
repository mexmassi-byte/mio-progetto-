import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { CurtainProvider } from "./components/Curtain";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { startSmoothScroll } from "./lib/scroll";

export default function App() {
  useEffect(() => {
    startSmoothScroll();
  }, []);
  return (
    <CurtainProvider>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <div className="grain" aria-hidden="true" />
    </CurtainProvider>
  );
}
