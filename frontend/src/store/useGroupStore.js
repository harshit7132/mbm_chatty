import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  isGroupsLoading: false,

  getMyGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/group/my-groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/group/create", groupData);
      set({ groups: [...get().groups, res.data] });
      toast.success("Group created successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    }
  },

  addMemberToGroup: async (groupId, userId) => {
    try {
      await axiosInstance.post(`/group/${groupId}/add-member`, { userId });
      toast.success("Member added successfully");
      get().getMyGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add member");
    }
  },

  setSelectedGroup: (group) => set({ selectedGroup: group }),

  updateGroupSettings: async (groupId, settings) => {
    try {
      const res = await axiosInstance.put(`/group/${groupId}/settings`, settings);
      set({ 
        groups: get().groups.map(g => g._id === groupId ? res.data : g),
        selectedGroup: res.data 
      });
      toast.success("Group settings updated");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group settings");
      return null;
    }
  },

  updateGroup: async (groupId, groupData) => {
    try {
      const res = await axiosInstance.put(`/group/${groupId}`, groupData);
      set({ 
        groups: get().groups.map(g => g._id === groupId ? res.data : g),
        selectedGroup: res.data 
      });
      toast.success("Group updated successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
      return null;
    }
  },

  changeGroupIcon: async (groupId, icon, iconType) => {
    try {
      const res = await axiosInstance.put(`/group/${groupId}/icon`, { icon, iconType });
      set({ 
        groups: get().groups.map(g => g._id === groupId ? res.data.group : g),
        selectedGroup: res.data.group 
      });
      toast.success(`Group icon updated! ${res.data.pointsDeducted} points deducted.`);
      return res.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to change group icon";
      toast.error(errorMsg);
      return null;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/group/${groupId}`);
      set({ 
        groups: get().groups.filter(g => g._id !== groupId),
        selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup
      });
      toast.success("Group deleted successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
      return false;
    }
  },
}));

