import { Phone, Video, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { useState } from "react";

const IncomingCallModal = ({ callData, onAnswer, onReject }) => {
  const { authUser } = useAuthStore();
  const { selectedUser, users } = useChatStore();
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  // Find the caller user from users list if selectedUser is not set
  const callerUser = selectedUser || users.find(u => u._id === callData?.fromUserId);

  console.log("📞 IncomingCallModal rendered with callData:", callData);
  console.log("📞 Caller user:", callerUser);

  if (!callData) {
    console.log("⚠️ IncomingCallModal: No callData, returning null");
    return null;
  }

  const handleAnswer = async () => {
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '[::1]';
      
      if (!isLocalhost) {
        toast.error(`${callData.type === "video" ? "Camera and microphone" : "Microphone"} require HTTPS. Please access the app via HTTPS or localhost.`);
        return;
      }
    }
    
    // Request permissions before answering
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(`${callData.type === "video" ? "Camera/microphone" : "Microphone"} access is not supported in this browser`);
        return;
      }

      setIsRequestingPermissions(true);
      toast.loading(`Requesting ${callData.type === "video" ? "camera and microphone" : "microphone"} access...`);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Device access timeout. Please check if your camera/microphone is in use by another application.")), 10000);
      });

      if (callData.type === "video") {
        // Request camera and microphone for video call
        const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 }, // Reduced to avoid timeout
            height: { ideal: 480 }, // Reduced to avoid timeout
            facingMode: "user"
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
        
        // Verify we got tracks
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        if (videoTracks.length === 0 && audioTracks.length === 0) {
          throw new Error("No media tracks available");
        }
        
        // Wait a moment to ensure permissions are fully established
        await new Promise(resolve => setTimeout(resolve, 500));
        
        stream.getTracks().forEach(track => track.stop());
      } else {
        // Request microphone only for voice call
        const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
        const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
        
        // Verify we got audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error("No audio tracks available");
        }
        
        // Wait a moment to ensure permissions are fully established
        await new Promise(resolve => setTimeout(resolve, 500));
        
        stream.getTracks().forEach(track => track.stop());
      }

      toast.dismiss();
      toast.success("Permissions granted!");
      setIsRequestingPermissions(false);
      
      // Now proceed with answering the call
      onAnswer();
    } catch (error) {
      toast.dismiss();
      setIsRequestingPermissions(false);
      console.error("Permission error:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error(`${callData.type === "video" ? "Camera/microphone" : "Microphone"} permission denied. Please allow access in your browser settings.`);
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        toast.error(`${callData.type === "video" ? "Camera or microphone" : "Microphone"} not found. Please check your devices.`);
      } else if (error.name === "AbortError" || error.message.includes("timeout") || error.message.includes("Timeout")) {
        toast.error("Device access timeout. Make sure your camera/microphone is not being used by another application and try again.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        toast.error("Camera/microphone is being used by another application. Please close other apps and try again.");
      } else {
        toast.error(`Failed to access ${callData.type === "video" ? "camera/microphone" : "microphone"}: ${error.message || error.name}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-base-100 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-4">
          <div className="avatar mx-auto">
            <div className="w-24 rounded-full">
              <img
                src={callerUser?.profilePic || callerUser?.avatar || "/avatar.png"}
                alt={callerUser?.fullName || callerUser?.username || "User"}
              />
            </div>
          </div>
          <h3 className="text-2xl font-bold">
            {callerUser?.fullName || callerUser?.username || "Incoming Call"}
          </h3>
          <p className="text-base-content/70">
            {callData.type === "video" ? "Video" : "Voice"} Call
          </p>

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={onReject}
              className="btn btn-circle btn-error btn-lg"
              title="Reject"
              disabled={isRequestingPermissions}
            >
              <X size={24} />
            </button>
            <button
              onClick={handleAnswer}
              className="btn btn-circle btn-success btn-lg"
              title="Answer"
              disabled={isRequestingPermissions}
            >
              {callData.type === "video" ? (
                <Video size={24} />
              ) : (
                <Phone size={24} />
              )}
            </button>
          </div>
          {isRequestingPermissions && (
            <p className="text-sm text-base-content/70 mt-2">
              Requesting permissions...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

