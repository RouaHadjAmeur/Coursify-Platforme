import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Check, AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Google API types
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | null, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const API = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading || googleLoading) return false;
    return email && password && /.+@.+\..+/.test(email);
  }, [loading, googleLoading, email, password]);

  // Initialize Google OAuth
  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "your-google-client-id",
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });
      }
    };

    // Load Google API script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Handle Google OAuth response
  const handleGoogleResponse = async (response: any) => {
    setGoogleLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Google authentication failed');
      }

      setMessage({ type: "success", text: "Google login successful! Redirecting..." });

      setTimeout(() => {
        if (data.isAdmin) {
          window.location.href = `${API}/`;
        } else {
          navigate("/");
        }
      }, 1500);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Google authentication failed" });
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Google button click
  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  const validateEmail = (value: string) => {
    if (!/.+@.+\..+/.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) {
      setPasswordError("Password is required");
      return false;
    }
    setPasswordError("");
    return true;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let data: any = {};
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        if (data.status === "pending") {
          throw new Error("Your account is pending admin approval. Please wait for approval before logging in.");
        } else if (data.status === "rejected") {
          throw new Error("Your account has been rejected by admin. Please contact support.");
        } else {
          throw new Error(data.message || "Something went wrong");
        }
      }

      setMessage({ type: "success", text: "Login successful! Redirecting..." });
      setEmail("");
      setPassword("");

      setTimeout(() => {
        if (data.isAdmin) {
          window.location.href = `${API}/`;
        } else {
          navigate("/");
        }
      }, 1500);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotPasswordEmail || !/.+@.+\..+/.test(forgotPasswordEmail)) {
      setForgotPasswordMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      let data: any = {};
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setForgotPasswordMessage({ type: "success", text: "Password reset email sent! Please check your inbox." });
      setForgotPasswordEmail("");

      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordMessage(null);
      }, 3000);
    } catch (err: any) {
      setForgotPasswordMessage({ type: "error", text: err.message || "Something went wrong. Please try again." });
    } finally {
      setForgotPasswordLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Panel */}
      <motion.div
        className="w-full lg:w-1/3 bg-gradient-to-b from-[#B0D0D3] to-[#C08497] relative overflow-hidden flex items-center justify-center p-6 lg:p-12 flex-shrink-0"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-8 left-8 w-16 h-16 bg-[#F7AF9D]/20 rounded-full"
            animate={{ y: [0, -15, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-16 right-8 w-12 h-12 bg-[#F7E3AF]/30 rounded-lg"
            animate={{ y: [0, 10, 0], x: [0, -8, 0], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-10 h-10 bg-[#F7AF9D]/40 rounded-full"
            animate={{ y: [0, -8, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/3 left-1/4 w-6 h-6 bg-[#F7AF9D]/25 rounded-lg"
            animate={{ rotate: [0, 180, 360], scale: [1, 1.15, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#F7AF9D]" />
        <div className="relative z-10 text-center text-white">
          <h2 className="text-2xl lg:text-3xl font-bold mb-3">Welcome Back!</h2>
          <p className="text-sm mb-6 opacity-90">
            To keep connected with us please login with your personal info
          </p>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onClick={() => navigate("/signup")}
            className="border-2 border-white text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-white hover:text-[#B0D0D3] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
          >
            SIGN UP
          </motion.button>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <motion.div
        className="w-full lg:w-2/3 bg-white flex items-center justify-center p-6 lg:p-12 flex-shrink-0"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#B0D0D3] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Coursify</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold text-[#B0D0D3] mb-6">Sign in to Coursify</h1>

          <div className="flex justify-center gap-3 mb-6">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0 }}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-[#B0D0D3] hover:text-[#B0D0D3] transition-colors"
            >
              <span className="font-semibold text-xs">f</span>
            </motion.button>
            
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-[#B0D0D3] hover:text-[#B0D0D3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
                </svg>
              ) : (
                <span className="font-semibold text-xs">G+</span>
              )}
            </motion.button>
            
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
                className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-[#B0D0D3] hover:text-[#B0D0D3] transition-colors"
              >
              <span className="font-semibold text-xs">in</span>
              </motion.button>
          </div>

          <div className="text-center text-gray-500 text-xs mb-6">or use your email account:</div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); validateEmail(e.target.value); }}
                onBlur={(e) => validateEmail(e.target.value)}
                className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                  emailError ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-[#B0D0D3]"
                }`}
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); validatePassword(e.target.value); }}
                onBlur={(e) => validatePassword(e.target.value)}
                className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-10 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                  passwordError ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-[#B0D0D3]"
                }`}
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-gray-500 hover:text-[#B0D0D3] transition-colors"
              >
                Forgot your password?
              </button>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                    message.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="font-medium">{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#B0D0D3] hover:bg-[#9BC0C3] text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20 flex items-center justify-center gap-2 text-sm"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.25" strokeWidth="4" fill="none" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
                </svg>
              )}
              {loading ? "Processing..." : "SIGN IN"}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
                <button onClick={() => setShowForgotPassword(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>

                {forgotPasswordMessage && (
                  <div
                    className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                      forgotPasswordMessage.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {forgotPasswordMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span className="font-medium">{forgotPasswordMessage.text}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!forgotPasswordEmail || forgotPasswordLoading}
                    className="flex-1 bg-[#B0D0D3] hover:bg-[#9BC0C3] text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20 flex items-center justify-center gap-2 text-sm"
                  >
                    {forgotPasswordLoading && (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.25" strokeWidth="4" fill="none" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
                      </svg>
                    )}
                    {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
