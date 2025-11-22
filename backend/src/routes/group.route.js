import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import Group from "../models/group.model.js";

const router = express.Router();

// Get my groups
router.get("/my-groups", protectRoute, async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.user._id,
    })
      .populate("createdBy", "fullName username email profilePic avatar")
      .populate("members", "fullName username email profilePic avatar")
      .populate("admins", "fullName username email profilePic avatar")
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.log("Error in getMyGroups:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Create group
router.post("/create", protectRoute, async (req, res) => {
  try {
    const { name, description, members } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    // Create group with creator as admin and member
    const group = new Group({
      name: name.trim(),
      description: description || "",
      createdBy: req.user._id,
      members: members && Array.isArray(members) ? [...members, req.user._id] : [req.user._id],
      admins: [req.user._id],
    });

    await group.save();

    // Populate before sending
    await group.populate("createdBy", "fullName username email profilePic avatar");
    await group.populate("members", "fullName username email profilePic avatar");
    await group.populate("admins", "fullName username email profilePic avatar");

    res.status(201).json(group);
  } catch (error) {
    console.log("Error in createGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get group by ID
router.get("/:groupId", protectRoute, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      members: req.user._id,
    })
      .populate("createdBy", "fullName username email profilePic avatar")
      .populate("members", "fullName username email profilePic avatar")
      .populate("admins", "fullName username email profilePic avatar");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in getGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add member to group
router.post("/:groupId/add-member", protectRoute, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin or creator
    const isAdmin = group.admins.includes(req.user._id) || group.createdBy.toString() === req.user._id.toString();
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can add members" });
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    group.members.push(userId);
    await group.save();

    await group.populate("members", "fullName username email profilePic avatar");

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in addMemberToGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Remove member from group
router.post("/:groupId/remove-member", protectRoute, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin or creator
    const isAdmin = group.admins.includes(req.user._id) || group.createdBy.toString() === req.user._id.toString();
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can remove members" });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId.toString()
    );
    group.admins = group.admins.filter(
      (adminId) => adminId.toString() !== userId.toString()
    );

    await group.save();

    res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    console.log("Error in removeMemberFromGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update group settings (only admins)
router.put("/:groupId/settings", protectRoute, async (req, res) => {
  try {
    const { onlyAdminsCanSendMessages } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin or creator
    const isAdmin = group.admins.includes(req.user._id) || group.createdBy.toString() === req.user._id.toString();
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can update settings" });
    }

    if (typeof onlyAdminsCanSendMessages === "boolean") {
      group.onlyAdminsCanSendMessages = onlyAdminsCanSendMessages;
    }

    await group.save();

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in updateGroupSettings:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add admin
router.post("/:groupId/add-admin", protectRoute, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only creator can add admins
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only group creator can add admins" });
    }

    // Check if user is a member
    if (!group.members.includes(userId)) {
      return res.status(400).json({ message: "User must be a member first" });
    }

    // Check if user is already an admin
    if (group.admins.includes(userId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    group.admins.push(userId);
    await group.save();

    res.status(200).json({ message: "Admin added successfully" });
  } catch (error) {
    console.log("Error in addAdmin:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update group (only creator)
router.put("/:groupId", protectRoute, async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only creator can update group
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only group creator can update the group" });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description || "";

    await group.save();

    await group.populate("createdBy", "fullName username email profilePic avatar");
    await group.populate("members", "fullName username email profilePic avatar");
    await group.populate("admins", "fullName username email profilePic avatar");

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in updateGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete group (only creator)
router.delete("/:groupId", protectRoute, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only creator can delete group
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only group creator can delete the group" });
    }

    // Delete all messages in the group
    const Message = (await import("../models/message.model.js")).default;
    await Message.deleteMany({ groupId: req.params.groupId });

    // Delete the group
    await Group.findByIdAndDelete(req.params.groupId);

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.log("Error in deleteGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get group members with visibility logic
router.get("/:groupId/members", protectRoute, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate("members", "fullName username email profilePic avatar")
      .populate("createdBy", "fullName username email profilePic avatar");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is a member
    if (!group.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const User = (await import("../models/user.model.js")).default;
    const Message = (await import("../models/message.model.js")).default;
    const currentUser = await User.findById(req.user._id).select("friends");
    
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isOwner = group.createdBy._id.toString() === req.user._id.toString();
    
    // Get friends list - ensure we have the friends field
    let friendsList = currentUser.friends || [];
    
    // Convert friends list to string array for easier comparison
    // Handle both ObjectId instances and string IDs
    let friendsListStr = friendsList.map(f => {
      if (!f) return null;
      // If it's an ObjectId instance, convert to string
      if (f._id) return f._id.toString();
      // If it's already a string, return as is
      if (typeof f === 'string') return f;
      // If it's an ObjectId object, use toString()
      return f.toString();
    }).filter(Boolean);
    
    // For each group member, check if they've chatted but aren't friends yet
    // Auto-add them as friends if they have message history
    for (const member of group.members) {
      const memberId = member._id.toString();
      const isCurrentUser = memberId === req.user._id.toString();
      
      if (!isCurrentUser && !friendsListStr.includes(memberId)) {
        // Check if they have chatted before
        const hasChatted = await Message.findOne({
          $or: [
            { senderId: req.user._id, receiverId: member._id },
            { senderId: member._id, receiverId: req.user._id },
          ],
        });
        
        if (hasChatted) {
          // Add to friends list
          if (!currentUser.friends) currentUser.friends = [];
          currentUser.friends.push(member._id);
          friendsListStr.push(memberId);
          
          // Also add current user to the other user's friends list
          const otherUser = await User.findById(member._id);
          if (otherUser) {
            if (!otherUser.friends) otherUser.friends = [];
            const otherUserFriends = otherUser.friends.map(f => f.toString());
            if (!otherUserFriends.includes(req.user._id.toString())) {
              otherUser.friends.push(req.user._id);
              await otherUser.save();
            }
          }
        }
      }
    }
    
    // Save updated friends list if it changed
    if (currentUser.isModified('friends')) {
      await currentUser.save();
    }
    
    // Process members with visibility logic
    const membersWithVisibility = group.members.map((member) => {
      const memberId = member._id.toString();
      const isCurrentUser = memberId === req.user._id.toString();
      
      // Check if member is in friends list
      const isFriend = friendsListStr.includes(memberId);
      
      // Owner can see all members, others can only see friends or themselves
      const canSee = isOwner || isCurrentUser || isFriend;
      
      return {
        _id: member._id,
        fullName: canSee ? (member.fullName || member.username || member.email?.split("@")[0] || "User") : "Suspicious",
        username: canSee ? member.username : null,
        email: canSee ? member.email : null,
        profilePic: canSee ? (member.profilePic || member.avatar || "") : "",
        avatar: canSee ? (member.avatar || member.profilePic || "") : "",
        isSuspicious: !canSee,
        isOwner: memberId === group.createdBy._id.toString(),
      };
    });

    res.status(200).json({
      members: membersWithVisibility,
      isOwner,
      totalMembers: group.members.length,
    });
  } catch (error) {
    console.log("Error in getGroupMembers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get group messages
router.get("/:groupId/messages", protectRoute, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const Message = (await import("../models/message.model.js")).default;
    const messages = await Message.find({ groupId: req.params.groupId })
      .populate("senderId", "fullName username email profilePic avatar")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getGroupMessages:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


