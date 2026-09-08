import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="text-on-surface font-body-md min-h-screen flex flex-col">
      {/* Side Navigation */}
      <nav className="hidden md:flex fixed left-0 h-full w-64 2k:w-72 bg-surface/60 backdrop-blur-xl border-r border-white/10 flex-col py-6 2k:py-8 z-40">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="w-16 h-16 2k:w-20 2k:h-20 rounded-full bg-surface-variant flex items-center justify-center mb-4 border border-white/10 shadow-lg">
            <span className="material-symbols-outlined text-3xl 2k:text-4xl text-primary">
              graphic_eq
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile font-bold text-on-surface 2k:text-xl">
            OmniVoice
          </h2>
          <p className="font-mono-data text-mono-data text-on-surface-variant 2k:text-sm">
            Phòng thu Pro v2.4
          </p>
        </div>
        <ul className="flex-1 px-4 2k:px-6 space-y-2 2k:space-y-3">
          <li>
            <Link
              to="/"
              className={cn(
                "flex items-center gap-3 px-4 py-3 2k:py-3.5 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps 2k:text-md",
                location.pathname === "/"
                  ? "text-primary border-r-2 border-primary bg-primary/5 font-semibold"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined 2k:text-3xl">
                graphic_eq
              </span>
              Phòng thu
            </Link>
          </li>
          <li>
            <Link
              to="/library"
              className={cn(
                "flex items-center gap-3 px-4 py-3 2k:py-3.5 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps 2k:text-md",
                location.pathname === "/library"
                  ? "text-primary border-r-2 border-primary bg-primary/5 font-semibold"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined 2k:text-3xl">
                folder_open
              </span>
              Thư viện
            </Link>
          </li>
          <li>
            <Link
              to="/cloning-voice"
              className={cn(
                "flex items-center gap-3 px-4 py-3 2k:py-3.5 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps 2k:text-md",
                location.pathname === "/cloning-voice"
                  ? "text-primary border-r-2 border-primary bg-primary/5 font-semibold"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined 2k:text-3xl">
                record_voice_over
              </span>
              Cloning Voice
            </Link>
          </li>
          <li>
            <Link
              to="/projects"
              className={cn(
                "flex items-center gap-3 px-4 py-3 2k:py-3.5 rounded-lg transition-all duration-300 ease-in-out font-label-caps text-label-caps 2k:text-md",
                location.pathname === "/projects"
                  ? "text-primary border-r-2 border-primary bg-primary/5 font-semibold"
                  : "text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined 2k:text-3xl">
                folder_shared
              </span>
              Projects
            </Link>
          </li>
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 2k:ml-72 p-margin-mobile md:p-margin-desktop 2k:p-10 flex justify-center items-start min-h-[calc(100vh-80px)] overflow-y-auto">
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
