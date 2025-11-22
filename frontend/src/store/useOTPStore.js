import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useOTPStore = create((set, get) => ({
  otpSent: false,
  isSendingOTP: false,
  isVerifyingOTP: false,
  otpEmail: "",

  sendOTP: async (email) => {
    set({ isSendingOTP: true });
    try {
      await axiosInstance.post("/auth/send-otp", { email });
      set({ otpSent: true, otpEmail: email });
      toast.success("OTP sent to your email");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
      return false;
    } finally {
      set({ isSendingOTP: false });
    }
  },

  verifyOTP: async (email, otp) => {
    set({ isVerifyingOTP: true });
    try {
      const res = await axiosInstance.post("/auth/verify-otp", { email, otp });
      set({ otpSent: false, otpEmail: "" });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
      return null;
    } finally {
      set({ isVerifyingOTP: false });
    }
  },

  loginWithOTP: async (email, otp) => {
    set({ isVerifyingOTP: true });
    try {
      const res = await axiosInstance.post("/auth/login-otp", { email, otp });
      // Use the same pattern as regular login
      useAuthStore.setState({ authUser: res.data });
      useAuthStore.getState().connectSocket();
      toast.success("Logged in successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
      return false;
    } finally {
      set({ isVerifyingOTP: false });
    }
  },

  resetOTP: () => set({ otpSent: false, otpEmail: "" }),
}));

