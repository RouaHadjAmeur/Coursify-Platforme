import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
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

export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role] = useState("student"); // Default role is student
  const [accept, setAccept] = useState(false);

  // Validation states
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [contactError, setContactError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading || googleLoading) return false;
    const validEmail = /.+@.+\..+/.test(email);
    const validPw = password.length >= 8;
    const matches = password === confirm;
    const validContact = contact.trim().length >= 8; // Minimum 8 digits for phone
    return firstName.trim().length >= 2 && lastName.trim().length >= 2 && validEmail && validContact && validPw && matches && accept;
  }, [loading, googleLoading, firstName, lastName, email, contact, password, confirm, accept]);

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
      const res = await fetch('http://localhost:3000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Google authentication failed');
      }

      setMessage({ type: "success", text: "Google signup successful! Redirecting..." });

      setTimeout(() => {
        if (data.isAdmin) {
          window.location.href = 'http://localhost:3000/';
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
  const handleGoogleSignup = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  // Validation functions
  const validateFirstName = (value: string) => {
    if (value.trim().length < 2) {
      setFirstNameError("First name must be at least 2 characters");
      return false;
    }
    setFirstNameError("");
    return true;
  };

  const validateLastName = (value: string) => {
    if (value.trim().length < 2) {
      setLastNameError("Last name must be at least 2 characters");
      return false;
    }
    setLastNameError("");
    return true;
  };

  const validateEmail = (value: string) => {
    if (!/.+@.+\..+/.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validateContact = (value: string) => {
    if (value.trim().length < 8) {
      setContactError("Phone number must be at least 8 digits");
      return false;
    }
    setContactError("");
    return true;
  };

  const validatePassword = (value: string) => {
    if (value.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateConfirm = (value: string) => {
    if (value !== password) {
      setConfirmError("Passwords do not match");
      return false;
    }
    setConfirmError("");
    return true;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage(null);

    try {
      console.log('Attempting signup with:', { firstName, lastName, email, contact, role, password: '***' });
      
      const response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          contact,
              password,
          role,
        }),
      });

      console.log('Signup response status:', response.status);
      const data = await response.json();
      console.log('Signup response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setMessage({ type: "success", text: "Account created successfully! Please wait for admin approval before logging in." });
      
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setContact("");
      setPassword("");
      setConfirm("");
      setAccept(false);
      
      // Redirect to login page after successful signup
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err: any) {
      console.error('Signup error:', err);
      setMessage({ type: "error", text: err.message || "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Panel - Signup Form */}
        <motion.div
        className="w-full lg:w-2/3 bg-white flex items-center justify-center p-6 lg:p-12 flex-shrink-0"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#B0D0D3] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
            <span className="text-xl font-bold text-gray-900">Coursify</span>
      </div>

          {/* Main Heading */}
          <h1 className="text-2xl lg:text-3xl font-bold text-[#B0D0D3] mb-6">
            Create Account
              </h1>

          {/* Social Login Buttons */}
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
              onClick={handleGoogleSignup}
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

          {/* Separator */}
          <div className="text-center text-gray-500 text-xs mb-6">
            or use your email for registration:
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
                         <div className="grid grid-cols-2 gap-3">
               <div className="relative">
                 <input
                   type="text"
                   placeholder="First Name"
                   value={firstName}
                   onChange={(e) => {
                     setFirstName(e.target.value);
                     validateFirstName(e.target.value);
                   }}
                   onBlur={(e) => validateFirstName(e.target.value)}
                   className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                     firstNameError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
                   }`}
                 />
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 {firstNameError && (
                   <p className="text-red-500 text-xs mt-1">{firstNameError}</p>
                 )}
               </div>
               <div className="relative">
                 <input
                   type="text"
                   placeholder="Last Name"
                   value={lastName}
                   onChange={(e) => {
                     setLastName(e.target.value);
                     validateLastName(e.target.value);
                   }}
                   onBlur={(e) => validateLastName(e.target.value)}
                   className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                     lastNameError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
                   }`}
                 />
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 {lastNameError && (
                   <p className="text-red-500 text-xs mt-1">{lastNameError}</p>
                 )}
            </div>
          </div>

                         <div className="relative">
               <input
                 type="email"
                 placeholder="Email"
                 value={email}
                 onChange={(e) => {
                   setEmail(e.target.value);
                   validateEmail(e.target.value);
                 }}
                 onBlur={(e) => validateEmail(e.target.value)}
                 className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                   emailError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
                 }`}
               />
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               {emailError && (
                 <p className="text-red-500 text-xs mt-1">{emailError}</p>
               )}
             </div>

             <div className="relative">
               <input
                 type="tel"
                 placeholder="Phone Number"
                 value={contact}
                 onChange={(e) => {
                   setContact(e.target.value);
                   validateContact(e.target.value);
                 }}
                 onBlur={(e) => validateContact(e.target.value)}
                 className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                   contactError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
                 }`}
               />
               <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
               </svg>
               {contactError && (
                 <p className="text-red-500 text-xs mt-1">{contactError}</p>
               )}
              </div>

                         <div className="relative">
               <input
                 type={showPassword ? "text" : "password"}
                 placeholder="Password"
                 value={password}
                 onChange={(e) => {
                   setPassword(e.target.value);
                   validatePassword(e.target.value);
                 }}
                 onBlur={(e) => validatePassword(e.target.value)}
                 className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-10 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                   passwordError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
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
               {passwordError && (
                 <p className="text-red-500 text-xs mt-1">{passwordError}</p>
               )}
             </div>

                         <div className="relative">
               <input
                 type={showConfirmPassword ? "text" : "password"}
                 placeholder="Confirm Password"
                 value={confirm}
                 onChange={(e) => {
                   setConfirm(e.target.value);
                   validateConfirm(e.target.value);
                 }}
                 onBlur={(e) => validateConfirm(e.target.value)}
                 className={`w-full bg-gray-50 border rounded-lg py-2.5 pl-10 pr-10 text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#B0D0D3]/20 placeholder:text-gray-500 text-sm ${
                   confirmError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#B0D0D3]'
                 }`}
               />
               <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <button
                 type="button"
                 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
               </button>
               {confirmError && (
                 <p className="text-red-500 text-xs mt-1">{confirmError}</p>
               )}
             </div>

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#B0D0D3] focus:ring-[#B0D0D3]"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
              />
              <label htmlFor="terms" className="text-xs text-gray-600">
                I agree to the{" "}
                <a href="#" className="font-medium text-[#B0D0D3] hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="font-medium text-[#B0D0D3] hover:underline">
                  Privacy Policy
                </a>
                .
                  </label>
                </div>

            {/* Message */}
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
                  {message.type === "success" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">{message.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#B0D0D3] hover:bg-[#9BC0C3] text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20 flex items-center justify-center gap-2 text-sm"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeOpacity="0.25"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}
              {loading ? "Processing..." : "SIGN UP"}
            </button>
            </form>
          </div>
      </motion.div>

      {/* Right Panel - Welcome Section */}
      <motion.div
        className="w-full lg:w-1/3 bg-gradient-to-b from-[#B0D0D3] to-[#C08497] relative overflow-hidden flex items-center justify-center p-6 lg:p-12 flex-shrink-0"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Background Shapes */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-8 left-8 w-16 h-16 bg-[#F7AF9D]/20 rounded-full"
            animate={{
              y: [0, -15, 0],
              x: [0, 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-16 right-8 w-12 h-12 bg-[#F7E3AF]/30 rounded-lg"
            animate={{
              y: [0, 10, 0],
              x: [0, -8, 0],
              rotate: [0, 90, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-10 h-10 bg-[#F3EEC3]/40 rounded-full"
            animate={{
              y: [0, -8, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/3 left-1/4 w-6 h-6 bg-[#F7AF9D]/25 rounded-lg"
            animate={{
              rotate: [0, 180, 360],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
      </div>

        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#F7AF9D]" />

        {/* Content */}
        <div className="relative z-10 text-center text-white">
          <h2 className="text-2xl lg:text-3xl font-bold mb-3">
            Hello, Friend!
          </h2>
          
          <p className="text-sm mb-6 opacity-90">
            Enter your personal details and start journey with us
          </p>

          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onClick={() => navigate('/login')}
            className="border-2 border-white text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-white hover:text-[#B0D0D3] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
          >
            SIGN IN
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
