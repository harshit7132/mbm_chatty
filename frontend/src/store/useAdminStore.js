import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useAdminStore = create((set, get) => ({
  dashboardStats: null,
  allUsers: [],
  isAdminLoading: false,

  getDashboardStats: async () => {
    set({ isAdminLoading: true });
    try {
      const res = await axiosInstance.get("/admin/dashboard");
      set({ dashboardStats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch dashboard stats");
    } finally {
      set({ isAdminLoading: false });
    }
  },

  getAllUsers: async () => {
    set({ isAdminLoading: true });
    try {
      const res = await axiosInstance.get("/admin/users");
      set({ allUsers: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isAdminLoading: false });
    }
  },

  deleteUser: async (userId) => {
    try {
      await axiosInstance.delete(`/admin/users/${userId}`);
      set({ allUsers: get().allUsers.filter((u) => u._id !== userId) });
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    }
  },

  makeAdmin: async (userId) => {
    try {
      await axiosInstance.post(`/admin/users/${userId}/make-admin`);
      toast.success("User made admin successfully");
      get().getAllUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to make user admin");
    }
  },
}));

