import { X, Video, Phone, Settings, Users, Image as ImageIcon } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useCallStore } from "../store/useCallStore";
import GroupMembers from "./GroupMembers";
import toast from "react-hot-toast";
import { useState, useRef } from "react";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, selectedChat } = useChatStore();
  const { selectedGroup, updateGroupSettings, changeGroupIcon } = useGroupStore();
  const { onlineUsers, socket, authUser } = useAuthStore();
  const { setActiveCall } = useCallStore();
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const fileInputRef = useRef(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [callType, setCallType] = useState("video");
  const [showMembersModal, setShowMembersModal] = useState(false);

  const handleVideoCall = async () => {
    if (!selectedChat || !selectedUser) return;
    
    // Check if there's already an incoming call - if so, don't allow new call
    const { incomingCall, activeCall } = useCallStore.getState();
    if (incomingCall) {
      toast.error("Please answer or reject the incoming call first");
      return;
    }
    
    // Check if there's already an active call
    if (activeCall) {
      toast.error("You are already in a call");
      return;
    }
    
    // Check if user is online
    if (!onlineUsers.some(id => id?.toString() === selectedUser._id?.toString())) {
      setCallType("video");
      setShowEmailModal(true);
      return;
    }
    
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '[::1]';
      
      if (!isLocalhost) {
        toast.error("Camera and microphone require HTTPS. Please access the app via HTTPS or localhost.");
        return;
      }
    }
    
    // Request camera and microphone permissions before starting call
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera/microphone access is not supported in this browser");
        return;
      }

      toast.loading("Requesting camera and microphone access...");
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Camera access timeout. Please check if your camera is in use by another application.")), 10000);
      });
      
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 }, // Reduced from 1280 to avoid timeout
          height: { ideal: 480 }, // Reduced from 720 to avoid timeout
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
      
      // Verify we actually got tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      if (videoTracks.length === 0 && audioTracks.length === 0) {
        throw new Error("No media tracks available");
      }
      
      // Wait a moment to ensure permissions are fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stop the test stream - we'll create a new one in VideoCall component
      stream.getTracks().forEach(track => track.stop());
      
      // Verify permissions are still available
      try {
        const videoPermission = await navigator.permissions.query({ name: 'camera' });
        const audioPermission = await navigator.permissions.query({ name: 'microphone' });
        console.log("Permission status - Camera:", videoPermission.state, "Microphone:", audioPermission.state);
      } catch (permError) {
        console.log("Cannot query permissions (some browsers don't support this)");
      }
      
      toast.dismiss();
      toast.success("Permissions granted!");
    } catch (error) {
      toast.dismiss();
      console.error("Permission error:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error("Camera/microphone permission denied. Please allow access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        toast.error("Camera or microphone not found. Please check your devices.");
      } else if (error.name === "AbortError" || error.message.includes("timeout") || error.message.includes("Timeout")) {
        toast.error("Camera access timeout. Make sure your camera is not being used by another application and try again.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        toast.error("Camera is being used by another application. Please close other apps using the camera and try again.");
      } else {
        toast.error("Failed to access camera/microphone: " + (error.message || error.name));
      }
      return; // Don't proceed with call if permissions are denied
    }
    
    const callData = {
      chatId: selectedChat._id,
      targetUserId: selectedUser._id,
      fromUserId: authUser._id,
      type: "video",
      isIncoming: false,
      callId: `call_${authUser._id}_${selectedUser._id}_${Date.now()}`, // Unique call ID
    };
    socket.emit("call-user", callData);
    // Store outgoing call data - will be used when receiver accepts
    useCallStore.getState().setOutgoingCall(callData);
    // Don't set activeCall immediately - wait for receiver to accept
    // The activeCall will be set when we receive "call-answered" event with answer: true
    
    // Set timeout to clear outgoing call if no response (30 seconds)
    setTimeout(() => {
      const callStore = useCallStore.getState();
      if (callStore.outgoingCall && callStore.outgoingCall.callId === callData.callId && !callStore.activeCall) {
        callStore.setOutgoingCall(null);
        toast.error("Call timed out - no answer");
      }
    }, 30000);
    
    toast.success("Calling...");
  };

  const handleVoiceCall = async () => {
    if (!selectedChat || !selectedUser) return;
    
    // Check if user is online
    if (!onlineUsers.some(id => id?.toString() === selectedUser._id?.toString())) {
      setCallType("voice");
      setShowEmailModal(true);
      return;
    }
    
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '[::1]';
      
      if (!isLocalhost) {
        toast.error("Microphone requires HTTPS. Please access the app via HTTPS or localhost.");
        return;
      }
    }
    
    // Request microphone permission before starting call
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Microphone access is not supported in this browser");
        return;
      }

      toast.loading("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: false
      });
      
      // Stop the test stream - we'll create a new one in VideoCall component
      stream.getTracks().forEach(track => track.stop());
      
      toast.dismiss();
      toast.success("Microphone permission granted!");
    } catch (error) {
      toast.dismiss();
      console.error("Permission error:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        toast.error("Microphone not found. Please check your device.");
      } else {
        toast.error("Failed to access microphone: " + error.message);
      }
      return; // Don't proceed with call if permissions are denied
    }
    
    const callData = {
      chatId: selectedChat._id,
      targetUserId: selectedUser._id,
      fromUserId: authUser._id,
      type: "voice",
      isIncoming: false,
      callId: `call_${authUser._id}_${selectedUser._id}_${Date.now()}`, // Unique call ID
    };
    socket.emit("call-user", callData);
    // Store outgoing call data - will be used when receiver accepts
    useCallStore.getState().setOutgoingCall(callData);
    // Don't set activeCall immediately - wait for receiver to accept
    // The activeCall will be set when we receive "call-answered" event with answer: true
    
    // Set timeout to clear outgoing call if no response (30 seconds)
    setTimeout(() => {
      const callStore = useCallStore.getState();
      if (callStore.outgoingCall && callStore.outgoingCall.callId === callData.callId && !callStore.activeCall) {
        callStore.setOutgoingCall(null);
        toast.error("Call timed out - no answer");
      }
    }, 30000);
    
    toast.success("Calling...");
  };

  const handleSendEmail = async () => {
    if (!emailMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingEmail(true);
    try {
      const { axiosInstance } = await import("../lib/axios");
      await axiosInstance.post("/call/send-email", {
        targetUserId: selectedUser._id,
        targetUserEmail: selectedUser.email,
        targetUserName: selectedUser.fullName || selectedUser.username || "User",
        callType: callType,
        message: emailMessage,
        fromUserName: authUser.fullName || authUser.username || "Someone",
      });
      toast.success("Email sent successfully!");
      setShowEmailModal(false);
      setEmailMessage("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleToggleGroupSetting = async () => {
    if (!selectedGroup) return;
    const newValue = !selectedGroup.onlyAdminsCanSendMessages;
    await updateGroupSettings(selectedGroup._id, { onlyAdminsCanSendMessages: newValue });
  };

  const handleIconFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGroup) return;

    setIsUploadingIcon(true);
    try {
      // Determine file type
      let iconType = "image";
      if (file.type === "image/gif") {
        iconType = "gif";
      } else if (file.type === "video/mp4") {
        iconType = "video";
        
        // Validate video duration (5-10 seconds)
        const video = document.createElement("video");
        video.preload = "metadata";
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const duration = video.duration;
            if (duration < 5 || duration > 10) {
              reject(new Error("Video must be between 5 and 10 seconds"));
            } else {
              resolve();
            }
          };
          video.onerror = () => reject(new Error("Failed to load video"));
          video.src = URL.createObjectURL(file);
        });
      } else if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type. Please select an image, GIF, or MP4 video");
        setIsUploadingIcon(false);
        return;
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result;
          await changeGroupIcon(selectedGroup._id, base64String, iconType);
        } catch (error) {
          console.error("Error uploading icon:", error);
          toast.error(error.message || "Failed to upload group icon");
        } finally {
          setIsUploadingIcon(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploadingIcon(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(error.message || "Failed to process file");
      setIsUploadingIcon(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isGroupAdmin = selectedGroup && (
    selectedGroup.admins?.some(admin => 
      (typeof admin === 'object' ? admin._id : admin) === authUser._id
    ) || selectedGroup.createdBy === authUser._id
  );

  const isGroupOwner = selectedGroup && (
    selectedGroup.createdBy === authUser._id ||
    (typeof selectedGroup.createdBy === 'object' && selectedGroup.createdBy._id === authUser._id)
  );

  if (!selectedUser && !selectedGroup) return null;
  
  // Don't show group header if a user is selected (user chat takes priority)
  if (selectedUser && selectedGroup) {
    return null;
  }

  // Group chat header
  if (selectedGroup) {
    return (
      <>
        <div className="p-2.5 border-b border-base-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Group Avatar */}
              <div className="avatar relative">
                {selectedGroup.groupIcon ? (
                  selectedGroup.groupIconType === "video" ? (
                    <video
                      src={selectedGroup.groupIcon}
                      className="size-10 rounded-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={selectedGroup.groupIcon}
                      alt={selectedGroup.name}
                      className="size-10 rounded-full object-cover"
                    />
                  )
                ) : (
                  <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users size={20} className="text-primary" />
                  </div>
                )}
                {isGroupOwner && (
                  <label
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    title="Change group icon (Owner only)"
                  >
                    <ImageIcon size={16} className="text-white" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/mp4"
                      className="hidden"
                      onChange={handleIconFileSelect}
                      disabled={isUploadingIcon}
                    />
                  </label>
                )}
              </div>

              {/* Group info - Clickable to view members */}
              <div
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowMembersModal(true)}
                title="Click to view group members"
              >
                <h3 className="font-medium">{selectedGroup.name}</h3>
                <div className="flex items-center gap-1 text-sm text-base-content/70">
                  <Users size={14} />
                  <span>{selectedGroup.members?.length || 0} members</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isGroupAdmin && (
                <button
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={() => setShowGroupSettings(!showGroupSettings)}
                  title="Group Settings"
                >
                  <Settings size={18} />
                </button>
              )}

              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => {
                  setSelectedUser(null);
                  useGroupStore.getState().setSelectedGroup(null);
                }}
                title="Close Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Group Settings Panel */}
          {showGroupSettings && isGroupAdmin && (
            <div className="mt-2 p-3 bg-base-200 rounded-lg space-y-3">
              <label className="label cursor-pointer">
                <span className="label-text">Only admins can send messages</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={selectedGroup.onlyAdminsCanSendMessages || false}
                  onChange={handleToggleGroupSetting}
                />
              </label>
              <div className="divider my-2"></div>
              {isGroupOwner && (
                <div>
                  <label className="label">
                    <span className="label-text">Group Icon (Owner only)</span>
                  </label>
                  <label className="btn btn-sm btn-outline w-full cursor-pointer" disabled={isUploadingIcon}>
                    {isUploadingIcon ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <>
                        <ImageIcon size={16} />
                        Change Icon
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/mp4"
                      className="hidden"
                      onChange={handleIconFileSelect}
                      disabled={isUploadingIcon}
                    />
                  </label>
                  <p className="text-xs text-base-content/70 mt-1">
                    Image: 2 points | GIF/Video: 5 points (Video: 5-10 seconds)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group Members Modal - Rendered outside header div */}
        {showMembersModal && selectedGroup && (
          <GroupMembers
            groupId={selectedGroup._id}
            onClose={() => setShowMembersModal(false)}
          />
        )}
      </>
    );
  }

  // Private chat header
  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={selectedUser.profilePic || "/avatar.png"}
                alt={selectedUser.fullName}
              />
              {onlineUsers.some(id => id?.toString() === selectedUser._id?.toString()) && (
                <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100"></span>
              )}
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.some(id => id?.toString() === selectedUser._id?.toString()) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={handleVideoCall}
            title="Video Call"
          >
            <Video size={18} />
          </button>

          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={handleVoiceCall}
            title="Voice Call"
          >
            <Phone size={18} />
          </button>

          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => setSelectedUser(null)}
            title="Close Chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Email Modal for Offline Users */}
      {showEmailModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              User is Offline - Send Email Request
            </h3>
            <p className="text-sm text-base-content/70 mb-4">
              {selectedUser?.fullName || "This user"} is currently offline. Send them an email to request a {callType === "video" ? "video" : "voice"} call.
            </p>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Your Message</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                placeholder={`Hi ${selectedUser?.fullName || "there"}, I'd like to have a ${callType === "video" ? "video" : "voice"} call with you...`}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailMessage("");
                }}
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailMessage.trim()}
              >
                {isSendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatHeader;
