import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // read token/email from query string only once
  useEffect(() => {
    if (!token && !email) {
      const qs = new URLSearchParams(search);
      const t = qs.get("token") || "";
      const e = qs.get("email") || "";
      setToken(t);
      setEmail(decodeURIComponent(e));

      // remove query from URL after setting state
      if (t || e) {
        const url = location.pathname;
        window.history.replaceState({}, "", url);
      }
    }
  }, [search, location.pathname, email, token]);

  const canSubmit = useMemo(() => {
    return !!email && !!token && newPassword.length >= 8 && newPassword === confirm && !loading;
  }, [email, token, newPassword, confirm, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");

      setMsg({ type: "success", text: "Password reset! Redirecting to login..." });
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  const linkBroken = !email || !token;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-2 text-gray-900">Set a new password</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter your new password. This link works only for a limited time.
        </p>

        {linkBroken && (
          <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700 border border-red-200 mb-4">
            The reset link is invalid. Please request a new one from the login page.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20"
            disabled={linkBroken}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#B0D0D3]/20"
            disabled={linkBroken}
          />

          {msg && (
            <div
              className={`text-sm rounded-lg p-3 ${
                msg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={linkBroken || !canSubmit}
            className="w-full bg-[#B0D0D3] hover:bg-[#9BC0C3] text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Saving..." : "Reset Password"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full mt-2 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
