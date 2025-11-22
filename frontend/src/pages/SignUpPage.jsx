import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useOTPStore } from "../store/useOTPStore";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";

import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [useOTP, setUseOTP] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const { signup, isSigningUp } = useAuthStore();
  const { sendOTP, verifyOTP, otpSent, isSendingOTP, isVerifyingOTP, resetOTP } = useOTPStore();

  const validateForm = () => {
    if (!formData.fullName.trim()) return toast.error("Full name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
    
    if (!useOTP) {
      if (!formData.password) return toast.error("Password is required");
      if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");
    } else {
      if (!otpVerified) return toast.error("Please verify OTP first");
    }

    return true;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Invalid email format");
      return;
    }
    await sendOTP(formData.email);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }
    const result = await verifyOTP(formData.email, otp);
    if (result) {
      setOtpVerified(true);
      toast.success("OTP verified! You can now complete registration.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (useOTP && !otpVerified) {
      toast.error("Please verify OTP first");
      return;
    }

    const success = validateForm();

    if (success === true) {
      try {
        if (useOTP) {
          // Signup with OTP (no password required)
          await signup({ ...formData, password: "otp-verified", otp });
        } else {
          await signup(formData);
        }
      } catch (error) {
        // Error is already handled in signup function with toast
        // This catch prevents unhandled promise rejection
        console.error("Signup failed:", error);
      }
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* left side */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* LOGO */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div
                className="size-12 rounded-xl bg-primary/10 flex items-center justify-center 
              group-hover:bg-primary/20 transition-colors"
              >
                <MessageSquare className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Create Account</h1>
              <p className="text-base-content/60">Get started with your free account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Full Name</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="size-5 text-base-content/40" />
                </div>
                <input
                  type="text"
                  className={`input input-bordered w-full pl-10`}
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="size-5 text-base-content/40" />
                </div>
                <input
                  type="email"
                  className={`input input-bordered w-full pl-10`}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {!useOTP ? (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Password</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="size-5 text-base-content/40" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`input input-bordered w-full pl-10`}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5 text-base-content/40" />
                    ) : (
                      <Eye className="size-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!otpSent ? (
                  <div className="form-control">
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      className="btn btn-outline btn-primary w-full"
                      disabled={isSendingOTP || !formData.email}
                    >
                      {isSendingOTP ? (
                        <>
                          <Loader2 className="size-5 animate-spin mr-2" />
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          <Smartphone className="size-5 mr-2" />
                          Send OTP to Email
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Enter OTP</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Smartphone className="size-5 text-base-content/40" />
                      </div>
                      <input
                        type="text"
                        className="input input-bordered w-full pl-10"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                      />
                    </div>
                    <label className="label">
                      <span className="label-text-alt">
                        OTP sent to {formData.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          resetOTP();
                          sendOTP(formData.email);
                        }}
                        className="label-text-alt link link-primary"
                      >
                        Resend
                      </button>
                    </label>
                    {!otpVerified && (
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        className="btn btn-outline btn-sm mt-2"
                        disabled={isVerifyingOTP || otp.length !== 6}
                      >
                        {isVerifyingOTP ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : (
                          "Verify OTP"
                        )}
                      </button>
                    )}
                    {otpVerified && (
                      <div className="alert alert-success mt-2">
                        <span>✓ OTP Verified Successfully</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setUseOTP(!useOTP);
                  resetOTP();
                  setOtp("");
                  setOtpVerified(false);
                }}
                className="btn btn-ghost btn-sm"
              >
                <Smartphone className="size-4 mr-2" />
                {useOTP ? "Use Password Instead" : "Sign Up with OTP (No Password)"}
              </button>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSigningUp}>
              {isSigningUp ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Loading...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-base-content/60">
              Already have an account?{" "}
              <Link to="/login" className="link link-primary">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* right side */}

      <AuthImagePattern
        title="Join our community"
        subtitle="Connect with friends, share moments, and stay in touch with your loved ones."
      />
    </div>
  );
};
export default SignUpPage;
