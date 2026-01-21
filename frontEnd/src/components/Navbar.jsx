import React, { useState, useEffect } from "react";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { useNavigate, Link, NavLink } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/auth/status", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.isAuthenticated) setUser(data.user);
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setUser(null);
        setShowProfileDropdown(false);
        navigate("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Desktop nav item with active underline/color
  const NavItem = ({ to, children, end = false }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "px-2 py-1 text-sm font-medium transition",
          isActive
            ? "text-gray-900 underline decoration-[3px] underline-offset-8"
            : "text-gray-700 hover:text-gray-900 hover:underline underline-offset-8",
        ].join(" ")
      }
      style={{ textDecorationColor: "#B0D0D3" }}
    >
      {children}
    </NavLink>
  );

  if (loading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl font-extrabold text-gray-900 shadow-sm bg-[#B0D0D3]">
              ED
            </div>
            <span className="hidden md:inline text-base font-semibold text-gray-900">
              EduLab
            </span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      {/* top strip */}
      <div className="hidden md:flex items-center justify-center px-4 py-1 text-xs font-medium text-gray-800 bg-[#F3EEC3]">
        Welcome ✨ Courses, projects & more!
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-[#B0D0D3] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">Coursify</span>
        </Link>

        {/* Desktop links */}
        <nav className="ml-6 hidden md:flex items-center gap-4">
          <NavItem to="/" end>Home</NavItem>
          <NavItem to="/courses">Courses</NavItem>
          {user && user.role === "instructor" && (
            <NavItem to="/instructor-courses">My Courses</NavItem>
          )}
          <NavItem to="/consulting">Consulting</NavItem>
          <NavItem to="/projects">Projects</NavItem>
          <NavItem to="/blog">Blog</NavItem>
          <NavItem to="/contact">Contact</NavItem>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search (desktop) */}
        <div className="hidden md:flex items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="w-60 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#B0D0D3]"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20"
              >
                <div className="w-8 h-8 bg-[#B0D0D3] rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span>{user.name}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showProfileDropdown ? "rotate-180" : ""}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate("/profile");
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
                style={{ backgroundColor: "#C08497" }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-2 inline-flex items-center justify-center rounded-xl p-2 md:hidden bg-[#F7AF9D]"
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden">
          <div className="mx-4 mb-3 rounded-2xl border border-black/10 bg-white p-3 shadow">
            <nav className="grid gap-2">
              {[
                { to: "/", label: "Home", end: true },
                { to: "/courses", label: "Courses" },
                { to: "/consulting", label: "Consulting" },
                { to: "/projects", label: "Projects" },
                { to: "/blog", label: "Blog" },
                { to: "/contact", label: "Contact" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-2 text-sm",
                      isActive ? "bg-gray-100 text-gray-900" : "hover:bg-gray-50 text-gray-700",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-3 grid gap-2">
              {user ? (
                <div className="px-3 py-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-[#B0D0D3] rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-semibold text-[#B0D0D3]">{user.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2 text-center text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2 text-center text-sm font-semibold text-white shadow-sm"
                    style={{ backgroundColor: "#C08497" }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>

            <div className="mt-3">
              <input
                type="text"
                placeholder="Search"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showProfileDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
      )}
    </header>
  );
}
