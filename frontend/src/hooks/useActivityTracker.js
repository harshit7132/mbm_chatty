import { useEffect, useRef } from "react";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Hook to track user activity (time spent on website)
 * Tracks time spent on any page and sends updates to backend
 */
export const useActivityTracker = () => {
  const { authUser } = useAuthStore();
  const activityIntervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const lastUpdateRef = useRef(null);
  const accumulatedMinutesRef = useRef(0);

  useEffect(() => {
    if (!authUser) {
      // User not logged in, clear any existing tracking
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      sessionStartRef.current = null;
      lastUpdateRef.current = null;
      accumulatedMinutesRef.current = 0;
      return;
    }

    // Initialize session start time
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }

    // Track activity and send to backend
    const trackActivity = async (minutes = 5) => {
      try {
        // Send activity update to backend
        await axiosInstance.post("/activity/track", { 
          minutes: minutes 
        });
        
        lastUpdateRef.current = Date.now();
        accumulatedMinutesRef.current = 0; // Reset accumulated minutes after update
      } catch (error) {
        console.error("Failed to track activity:", error);
        // Don't show error to user, just log it
      }
    };

    // Calculate and send accumulated activity
    const sendAccumulatedActivity = () => {
      if (!sessionStartRef.current) return;
      
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - sessionStartRef.current) / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      
      // Only send if at least 5 minutes have passed since last update
      if (elapsedMinutes >= 5 && (!lastUpdateRef.current || (now - lastUpdateRef.current) >= 5 * 60 * 1000)) {
        const minutesToSend = Math.min(elapsedMinutes, 10); // Cap at 10 minutes per update
        trackActivity(minutesToSend);
        sessionStartRef.current = now; // Reset session start after update
      }
    };

    // Track activity on page visibility change (user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // User came back to the page, reset session start
        sessionStartRef.current = Date.now();
        // Send any accumulated activity
        sendAccumulatedActivity();
      } else {
        // User left the page, send accumulated activity before leaving
        sendAccumulatedActivity();
      }
    };

    // Track activity periodically (every 5 minutes)
    activityIntervalRef.current = setInterval(() => {
      sendAccumulatedActivity();
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Track activity on user interaction (mouse move, click, scroll, etc.)
    // This ensures we know user is actively using the site
    let interactionTimeout;
    const handleUserInteraction = () => {
      clearTimeout(interactionTimeout);
      // Reset session start on interaction to track continuous activity
      if (!sessionStartRef.current || (Date.now() - sessionStartRef.current) > 10 * 60 * 1000) {
        sessionStartRef.current = Date.now();
      }
      
      interactionTimeout = setTimeout(() => {
        // User was active, send accumulated activity
        sendAccumulatedActivity();
      }, 5 * 60 * 1000); // Send after 5 minutes of activity
    };

    window.addEventListener("mousemove", handleUserInteraction, { passive: true });
    window.addEventListener("click", handleUserInteraction, { passive: true });
    window.addEventListener("scroll", handleUserInteraction, { passive: true });
    window.addEventListener("keydown", handleUserInteraction, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Send activity when component mounts (user just logged in or page loaded)
    sendAccumulatedActivity();

    // Cleanup
    return () => {
      // Send any remaining activity before cleanup
      sendAccumulatedActivity();
      
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleUserInteraction);
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("scroll", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      clearTimeout(interactionTimeout);
    };
  }, [authUser]);
};

