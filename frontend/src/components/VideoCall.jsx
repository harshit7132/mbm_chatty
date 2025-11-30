import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const VideoCall = ({ callData, onEndCall }) => {
  const { authUser, socket } = useAuthStore();
  const { selectedUser } = useChatStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState("connecting");

  // Initialize Agora RTC
  useEffect(() => {
    if (!callData || !authUser) return;

    const initializeAgora = async () => {
      try {
        if (!authUser._id) {
          throw new Error("User ID is missing. Please log in again.");
        }

        const userIdToSend = String(authUser._id).trim();
        if (userIdToSend === "" || userIdToSend === "null" || userIdToSend === "undefined") {
          throw new Error("User ID is invalid. Please log in again.");
        }

        // Create channel name (same for both users)
        const userIds = callData.isIncoming
          ? [callData.fromUserId, authUser._id].sort()
          : [authUser._id, callData.targetUserId].sort();
        const channelName = `room_${userIds[0]}_${userIds[1]}`;

        console.log("📤 Requesting Agora token from backend...");

        // Get token from backend
        const tokenResponse = await axiosInstance.post(
          "/agora/generate-token",
          {
            userId: userIdToSend,
            channelName: channelName
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        // Validate response
        const { appId, token, channelName: responseChannelName, uid } = tokenResponse.data;
        
        if (!appId || !token || !responseChannelName) {
          throw new Error("Invalid token response from backend. Missing appId, token, or channelName.");
        }

        // Validate token is a string
        const tokenString = String(token).trim();
        if (!tokenString || tokenString === 'undefined' || tokenString === 'null') {
          throw new Error("Invalid token format");
        }

        console.log("✅ Token received:", {
          appId,
          channelName: responseChannelName,
          tokenLength: tokenString.length,
          uid
        });

        // Create Agora RTC client
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // Set up event handlers
        client.on("user-published", async (user, mediaType) => {
          console.log("📡 Remote user published:", user.uid, mediaType);
          
          // Subscribe to the remote user
          await client.subscribe(user, mediaType);
          console.log("✅ Subscribed to remote user");

          // Only handle video if this is a video call
          if (mediaType === "video" && callData.type === "video") {
            // Display remote video in the remote video container (main area - left side)
            // Wait for component to fully render and container to exist
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const playRemoteVideo = (retries = 20) => {
              // First, try to find container by ID if ref is not set
              if (!remoteVideoRef.current) {
                const containerById = document.getElementById("remote-video-container");
                if (containerById) {
                  console.log("✅ Found container by ID, updating ref");
                  remoteVideoRef.current = containerById;
                }
              }
              
              // Check if ref exists now
              if (!remoteVideoRef.current) {
                if (retries > 0) {
                  console.log(`⏳ Remote container ref not ready, retrying... (${retries} attempts left)`);
                  setTimeout(() => playRemoteVideo(retries - 1), 300);
                } else {
                  console.error("❌ Remote video container ref not found after retries");
                  // Try to find by ID as fallback
                  const containerById = document.getElementById("remote-video-container");
                  if (containerById && user.videoTrack) {
                    console.log("✅ Found container by ID, playing video");
                    containerById.innerHTML = "";
                    try {
                      user.videoTrack.play(containerById);
                      console.log("✅ Video playing in container found by ID");
                      // Update ref for future use
                      remoteVideoRef.current = containerById;
                    } catch (error) {
                      console.error("❌ Error playing video in container by ID:", error);
                    }
                  } else {
                    console.error("❌ Container by ID also not found. Available elements:", {
                      byId: !!containerById,
                      hasVideoTrack: !!user.videoTrack,
                      allContainers: document.querySelectorAll("[id*='video']").length
                    });
                    // Last resort: try to find any video container or create one
                    if (user.videoTrack && !containerById) {
                      console.log("⚠️ Container not found, searching for parent...");
                      // Try to find the parent container by looking for the flex container
                      const parentContainers = document.querySelectorAll('div[style*="flex: 1"]');
                      for (const parent of parentContainers) {
                        if (parent.querySelector('[id*="video"]') || parent.textContent.includes("Connecting")) {
                          const newContainer = document.createElement("div");
                          newContainer.id = "remote-video-container";
                          newContainer.style.cssText = "width: 100%; height: 100%; minHeight: 100%; minWidth: 100%; objectFit: cover; position: relative; display: block";
                          parent.appendChild(newContainer);
                          remoteVideoRef.current = newContainer;
                          user.videoTrack.play(newContainer);
                          console.log("✅ Created and played video in dynamically created container");
                          return;
                        }
                      }
                      // If still not found, just play the video track (Agora will create element)
                      console.log("⚠️ No container found, letting Agora handle video display");
                      user.videoTrack.play();
                    }
                  }
                }
                return;
              }
              
              if (user.videoTrack) {
                try {
                  // Clear any existing video elements in remote container
                  remoteVideoRef.current.innerHTML = "";
                  
                  // IMPORTANT: Ensure local video is NOT in remote container
                  // Check if local video accidentally got into remote container
                  const allVideos = document.querySelectorAll("video");
                  allVideos.forEach(video => {
                    // If video is in remote container but is actually local video, remove it
                    if (remoteVideoRef.current.contains(video) && localVideoTrackRef.current) {
                      const localTrack = localVideoTrackRef.current.getMediaStreamTrack();
                      if (video.srcObject) {
                        const videoTracks = video.srcObject.getVideoTracks();
                        if (videoTracks.length > 0 && videoTracks[0].id === localTrack.id) {
                          console.warn("⚠️ Found local video in remote container, removing it");
                          video.remove();
                        }
                      }
                    }
                  });
                  
                  // Play remote video (OTHER USER'S FACE) in the REMOTE container (main area)
                  user.videoTrack.play(remoteVideoRef.current);
                  console.log("✅ Remote video (OTHER USER'S FACE) playing in REMOTE container (main area - left side)");
                  
                  // Double-check: ensure local video is NOT playing here
                  setTimeout(() => {
                    if (remoteVideoRef.current) {
                      const videosInRemote = remoteVideoRef.current.querySelectorAll("video");
                      videosInRemote.forEach(video => {
                        if (localVideoTrackRef.current) {
                          const localTrack = localVideoTrackRef.current.getMediaStreamTrack();
                          if (video.srcObject) {
                            const videoTracks = video.srcObject.getVideoTracks();
                            if (videoTracks.length > 0 && videoTracks[0].id === localTrack.id) {
                              console.error("❌ Local video found in remote container! Removing...");
                              video.remove();
                              // Re-play local video in correct container
                              if (localVideoRef.current) {
                                localVideoTrackRef.current.play(localVideoRef.current);
                              }
                            }
                          }
                        }
                      });
                    }
                  }, 500);
                } catch (error) {
                  console.error("❌ Error playing remote video:", error);
                  // Retry on error
                  if (retries > 0) {
                    setTimeout(() => playRemoteVideo(retries - 1), 300);
                  }
                }
              } else {
                console.log("⏳ Waiting for video track...");
                if (retries > 0) {
                  setTimeout(() => playRemoteVideo(retries - 1), 300);
                }
              }
            };
            
            // Try to play immediately, with retries if needed
            playRemoteVideo();
          }

          if (mediaType === "audio") {
            // Play remote audio
            user.audioTrack?.play();
            console.log("✅ Remote audio playing");
          }

          setCallStatus("connected");
        });

        client.on("user-unpublished", (user, mediaType) => {
          console.log("👋 Remote user unpublished:", user.uid, mediaType);
          
          if (mediaType === "video") {
            if (remoteVideoRef.current) {
              // Clear remote video container
              remoteVideoRef.current.innerHTML = "";
              user.videoTrack?.stop();
              console.log("✅ Remote video stopped and container cleared");
            }
          }
          
          if (mediaType === "audio") {
            user.audioTrack?.stop();
            console.log("✅ Remote audio stopped");
          }
        });

        client.on("user-left", (user) => {
          console.log("👋 User left:", user.uid);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = "";
          }
        });

        // Join the channel
        console.log("🔧 Joining channel:", responseChannelName);
        const agoraUid = await client.join(
          appId,
          responseChannelName,
          tokenString,
          uid || null // Use provided UID or let Agora assign one
        );

        console.log("✅ Joined channel with UID:", agoraUid);

        // Create local tracks
        console.log("🎥 Creating local tracks...");
        
        if (callData.type === "video") {
          // Create video track
          localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: "480p" // Medium quality
          });
          
          // Display local video in the local video container (small preview - top right)
          // Use a retry mechanism to ensure container is ready
          const playLocalVideo = (retries = 5) => {
            if (localVideoRef.current && localVideoTrackRef.current) {
              try {
                // Clear any existing video elements in local container
                localVideoRef.current.innerHTML = "";
                
                // IMPORTANT: Play local video ONLY in local container (small preview)
                localVideoTrackRef.current.play(localVideoRef.current);
                console.log("✅ Local video (MY FACE) displayed in LOCAL container (small preview - top right)");
                
                // Double-check: ensure it's NOT in remote container
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    const videosInRemote = remoteVideoRef.current.querySelectorAll("video");
                    videosInRemote.forEach(video => {
                      const localTrack = localVideoTrackRef.current.getMediaStreamTrack();
                      if (video.srcObject) {
                        const videoTracks = video.srcObject.getVideoTracks();
                        if (videoTracks.length > 0 && videoTracks[0].id === localTrack.id) {
                          console.error("❌ Local video found in remote container! Removing...");
                          video.remove();
                        }
                      }
                    });
                  }
                }, 200);
              } catch (error) {
                console.error("❌ Error playing local video:", error);
              }
            } else if (retries > 0) {
              // Retry after a short delay if container not ready
              console.log(`⏳ Local container not ready, retrying... (${retries} attempts left)`);
              setTimeout(() => playLocalVideo(retries - 1), 200);
            } else {
              console.error("❌ Local video container not found after retries");
            }
          };
          
          // Try to play immediately, with retries if needed
          playLocalVideo();
        }

        // Create audio track
        localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
        console.log("✅ Local audio track created");

        // Publish local tracks
        console.log("📤 Publishing local tracks...");
        const tracksToPublish = [];
        if (localVideoTrackRef.current) {
          tracksToPublish.push(localVideoTrackRef.current);
        }
        if (localAudioTrackRef.current) {
          tracksToPublish.push(localAudioTrackRef.current);
        }

        if (tracksToPublish.length > 0) {
          await client.publish(tracksToPublish);
          console.log("✅ Local tracks published");
        }

        setCallStatus("connected");
      } catch (error) {
        console.error("❌ Error initializing Agora:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });

        let errorMessage = "Failed to start call";
        if (error.message.includes("Permission denied") || error.message.includes("NotAllowedError")) {
          errorMessage = "Camera/microphone permission denied. Please allow access in browser settings.";
        } else if (error.message.includes("NotFoundError")) {
          errorMessage = "Camera or microphone not found. Please check your devices.";
        } else if (error.message.includes("NotReadableError")) {
          errorMessage = "Camera or microphone is being used by another application.";
        } else {
          errorMessage = "Failed to start call: " + error.message;
        }

        toast.error(errorMessage);
        if (onEndCall) onEndCall();
      }
    };

    initializeAgora();

    // Cleanup function
    return () => {
      cleanup();
    };
  }, [callData, authUser, onEndCall]);

  const cleanup = async () => {
    console.log("🧹 Cleaning up Agora RTC...");
    
    try {
      // Stop and close local tracks
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      // Leave channel and destroy client
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = "";
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = "";
      }
    } catch (err) {
      console.warn("Error during cleanup:", err);
    }
  };

  const toggleMute = async () => {
    try {
      if (!localAudioTrackRef.current) {
        console.error("❌ No audio track available to mute/unmute");
        toast.error("Audio track not available");
        return;
      }
      
      const newMuteState = !isMuted;
      // setEnabled(false) = mute, setEnabled(true) = unmute
      const success = await localAudioTrackRef.current.setEnabled(!newMuteState);
      
      if (success !== false) {
        setIsMuted(newMuteState);
        console.log(newMuteState ? "🔇 Microphone muted" : "🔊 Microphone unmuted");
        console.log("Audio track enabled state:", localAudioTrackRef.current.isPlaying, localAudioTrackRef.current.enabled);
        toast.success(newMuteState ? "Microphone muted" : "Microphone unmuted", { duration: 1000 });
      } else {
        console.error("❌ Failed to set audio track enabled state");
        toast.error("Failed to toggle microphone");
      }
    } catch (error) {
      console.error("❌ Error toggling mute:", error);
      toast.error("Failed to toggle microphone: " + error.message);
    }
  };

  const toggleVideo = async () => {
    try {
      if (!localVideoTrackRef.current) {
        console.error("❌ No video track available to toggle");
        toast.error("Video track not available");
        return;
      }
      
      if (callData?.type !== "video") {
        console.log("⚠️ Not a video call, cannot toggle video");
        return;
      }
      
      const newVideoState = !isVideoOff;
      // setEnabled(false) = hide video, setEnabled(true) = show video
      await localVideoTrackRef.current.setEnabled(!newVideoState);
      setIsVideoOff(newVideoState);
      console.log(newVideoState ? "📹 Camera off" : "📹 Camera on");
      toast.success(newVideoState ? "Camera turned off" : "Camera turned on", { duration: 1000 });
      
      // Ensure local video stays in local container after toggle
      if (!newVideoState && localVideoRef.current) {
        // Video is being shown again, re-play in local container ONLY
        setTimeout(() => {
          if (localVideoTrackRef.current && localVideoRef.current) {
            // Clear local container
            localVideoRef.current.innerHTML = "";
            
            // Play in local container
            localVideoTrackRef.current.play(localVideoRef.current);
            console.log("✅ Local video replayed in LOCAL container after toggle");
            
            // Ensure it's NOT in remote container
            if (remoteVideoRef.current) {
              const videosInRemote = remoteVideoRef.current.querySelectorAll("video");
              videosInRemote.forEach(video => {
                const localTrack = localVideoTrackRef.current.getMediaStreamTrack();
                if (video.srcObject) {
                  const videoTracks = video.srcObject.getVideoTracks();
                  if (videoTracks.length > 0 && videoTracks[0].id === localTrack.id) {
                    console.error("❌ Local video found in remote container after toggle! Removing...");
                    video.remove();
                  }
                }
              });
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error("❌ Error toggling video:", error);
      toast.error("Failed to toggle camera");
    }
  };

  const handleEndCall = async () => {
    // Emit call-end event to notify the other user
    if (socket && callData) {
      const targetUserId = callData.isIncoming 
        ? callData.fromUserId 
        : callData.targetUserId;
      socket.emit("call-end", { targetUserId });
      console.log("📤 Emitted call-end event to:", targetUserId);
    }
    await cleanup();
    if (onEndCall) onEndCall();
  };

  // Listen for call-ended event from the other user
  useEffect(() => {
    if (!socket || !callData) return;

    const handleCallEnded = async (data) => {
      console.log("📥 Received call-ended event from:", data?.fromUserId);
      // Verify this is the correct call
      const expectedUserId = callData.isIncoming 
        ? callData.fromUserId 
        : callData.targetUserId;
      
      if (data?.fromUserId === expectedUserId) {
        console.log("✅ Call ended by other user, ending call...");
        await cleanup();
        if (onEndCall) onEndCall();
      }
    };

    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, callData, onEndCall]);

  // Ensure refs are set when component mounts and force re-render if needed
  useEffect(() => {
    if (callData) {
      // Force a small delay to ensure DOM is ready
      const checkRefs = () => {
        if (remoteVideoRef.current) {
          console.log("✅ Remote video container ref is ready");
        } else {
          console.log("⏳ Remote video container ref not ready yet");
          // Try to find by ID and update ref
          const containerById = document.getElementById("remote-video-container");
          if (containerById && !remoteVideoRef.current) {
            console.log("✅ Found remote container by ID, but ref not set");
          }
        }
        if (localVideoRef.current) {
          console.log("✅ Local video container ref is ready");
        } else {
          console.log("⏳ Local video container ref not ready yet");
          // Try to find by ID and update ref
          const containerById = document.getElementById("local-video-container");
          if (containerById && !localVideoRef.current) {
            console.log("✅ Found local container by ID, but ref not set");
          }
        }
      };
      
      // Check immediately
      checkRefs();
      
      // Check again after a short delay
      setTimeout(checkRefs, 100);
      setTimeout(checkRefs, 500);
      setTimeout(checkRefs, 1000);
    }
  }, [callData]);

  if (!callData) return null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Video containers - only show for video calls */}
      {callData.type === "video" ? (
        <div style={{ flex: 1, position: "relative", display: "flex", gap: "10px", padding: "10px" }}>
          {/* Remote video (main) */}
          <div style={{ 
            flex: 1, 
            position: "relative", 
            backgroundColor: "#1a1a1a", 
            borderRadius: "12px", 
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <div
              ref={remoteVideoRef}
              id="remote-video-container"
              style={{
                width: "100%",
                height: "100%",
                minHeight: "100%",
                minWidth: "100%",
                objectFit: "cover",
                position: "relative",
                display: "block"
              }}
            />
            {callStatus === "connecting" && (
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "18px",
                fontWeight: "500"
              }}>
                Connecting...
              </div>
            )}
            {callStatus === "connected" && !remoteVideoRef.current?.querySelector("video") && (
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "16px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>👤</div>
                <div>Waiting for remote video...</div>
              </div>
            )}
          </div>

          {/* Local video (small preview) */}
          {callData.type === "video" && (
          <div style={{
            width: "240px",
            height: "180px",
            position: "relative",
            backgroundColor: "#1a1a1a",
            borderRadius: "12px",
            overflow: "hidden",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
          }}>
            <div
              ref={localVideoRef}
              id="local-video-container"
              style={{
                width: "100%",
                height: "100%",
                minHeight: "100%",
                minWidth: "100%",
                objectFit: "cover",
                position: "relative",
                display: "block"
              }}
            />
            {isVideoOff && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#1a1a1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "32px"
              }}>
                📹
              </div>
            )}
            {isMuted && (
              <div style={{
                position: "absolute",
                bottom: "8px",
                left: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                padding: "4px 8px",
                borderRadius: "4px",
                color: "white",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <MicOff size={14} />
                Muted
              </div>
            )}
          </div>
        )}
        </div>
      ) : (
        // Voice call UI - show avatar/name instead of video
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{
            textAlign: "center",
            color: "white"
          }}>
            <div style={{ fontSize: "120px", marginBottom: "20px" }}>📞</div>
            <div style={{ fontSize: "24px", fontWeight: "500", marginBottom: "10px" }}>
              {selectedUser?.fullName || "Voice Call"}
            </div>
            <div style={{ fontSize: "16px", opacity: 0.7 }}>
              {callStatus === "connecting" ? "Connecting..." : callStatus === "connected" ? "Connected" : "Calling..."}
            </div>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "16px",
        padding: "24px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(10px)"
      }}>
        {/* Mute/Unmute Button */}
        <button
          onClick={toggleMute}
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: isMuted ? "#ef4444" : "#374151",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.backgroundColor = isMuted ? "#dc2626" : "#4b5563";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.backgroundColor = isMuted ? "#ef4444" : "#374151";
          }}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        {/* Video Toggle Button (only for video calls) */}
        {callData.type === "video" && (
          <button
            onClick={toggleVideo}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: isVideoOff ? "#ef4444" : "#374151",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.backgroundColor = isVideoOff ? "#dc2626" : "#4b5563";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.backgroundColor = isVideoOff ? "#ef4444" : "#374151";
            }}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}

        {/* End Call Button */}
        <button
          onClick={handleEndCall}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "#ef4444",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.backgroundColor = "#dc2626";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.backgroundColor = "#ef4444";
          }}
          title="End call"
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
