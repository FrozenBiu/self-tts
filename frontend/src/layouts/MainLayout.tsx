import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="text-on-surface font-body-md min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="fixed top-0 w-full z-50 bg-surface/60 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(245,158,11,0.15)] h-20">
        <div className="flex justify-between items-center px-margin-desktop h-full max-w-max-width mx-auto">
          <div className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight md:text-headline-lg text-headline-lg-mobile md:font-headline-lg font-headline-lg-mobile">
            VoxCPM2 Studio
          </div>
          <div className="flex gap-4">
            <button className="text-on-surface-variant hover:text-primary transition-colors duration-200 active:scale-95 transition-transform p-2 rounded-full">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                settings
              </span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors duration-200 active:scale-95 transition-transform p-2 rounded-full">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                account_circle
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Side Navigation */}
      <nav className="hidden md:flex fixed left-0 top-20 h-[calc(100vh-80px)] w-64 bg-surface/60 backdrop-blur-xl border-r border-white/10 flex-col py-6 z-40">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-4 border border-white/10">
            <span className="material-symbols-outlined text-3xl text-primary">
              person
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile font-bold text-on-surface">
            VoxCPM2
          </h2>
          <p className="font-mono-data text-mono-data text-on-surface-variant">
            Phòng thu Pro v2.4
          </p>
        </div>
        <ul className="flex-1 px-4 space-y-2">
          <li>
            <Link
              to="/"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps",
                location.pathname === "/"
                  ? "text-primary border-r-2 border-primary bg-primary/5"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined">graphic_eq</span>
              Phòng thu
            </Link>
          </li>
          <li>
            <Link
              to="/library"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps",
                location.pathname === "/library"
                  ? "text-primary border-r-2 border-primary bg-primary/5"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined">folder_open</span>
              Thư viện
            </Link>
          </li>
          <li>
            <Link
              to="/cloning-voice"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps",
                location.pathname === "/cloning-voice"
                  ? "text-primary border-r-2 border-primary bg-primary/5"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined">
                record_voice_over
              </span>
              Cloning Voice
            </Link>
          </li>
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 mt-20 p-margin-mobile md:p-margin-desktop flex justify-center items-start min-h-[calc(100vh-80px)] overflow-y-auto">
        <Outlet />
      </main>

      {/* Mobile Navigation (Bottom) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest/90 backdrop-blur-md border-t border-white/5 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          <Link
            to="/"
            className={cn(
              "flex flex-col items-center justify-center w-full h-full relative transition-colors",
              location.pathname === "/"
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span className="material-symbols-outlined mb-1">graphic_eq</span>
            <span className="text-[10px] font-label-caps">Phòng thu</span>
            {location.pathname === "/" && (
              <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"></div>
            )}
          </Link>
          <Link
            to="/library"
            className={cn(
              "flex flex-col items-center justify-center w-full h-full relative transition-colors",
              location.pathname === "/library"
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span className="material-symbols-outlined mb-1">folder_open</span>
            <span className="text-[10px] font-label-caps">Thư viện</span>
            {location.pathname === "/library" && (
              <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"></div>
            )}
          </Link>
          <Link
            to="/cloning-voice"
            className={cn(
              "flex flex-col items-center justify-center w-full h-full relative transition-colors",
              location.pathname === "/cloning-voice"
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span className="material-symbols-outlined mb-1">
              record_voice_over
            </span>
            <span className="text-[10px] font-label-caps">Cloning Voice</span>
            {location.pathname === "/cloning-voice" && (
              <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"></div>
            )}
          </Link>
        </div>
      </nav>
    </div>
  );
}
