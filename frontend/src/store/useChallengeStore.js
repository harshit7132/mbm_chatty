import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useChallengeStore = create((set, get) => ({
  dailyChallenges: [],
  lifetimeChallenges: [],
  isChallengesLoading: false,
  challengeReversal: null, // Store reversal data for modal display
  
  // Initialize socket listener for real-time updates
  initSocketListener: (socket) => {
    if (!socket) {
      console.warn("Cannot initialize challenge socket listener: socket is null");
      return;
    }
    
    // Remove any existing listeners to avoid duplicates
    socket.off("challenge-updated");
    socket.off("challenge-reversed");

    
    
    // Set up real-time challenge update listener
    const handleChallengeUpdate = (updatedChallenges) => {
      console.log("📡 [CHALLENGE STORE] Received real-time challenge updates via socket:", updatedChallenges);
      console.log("📡 [CHALLENGE STORE] Current daily challenges count:", get().dailyChallenges.length);
      console.log("📡 [CHALLENGE STORE] Current lifetime challenges count:", get().lifetimeChallenges.length);
      
      if (!Array.isArray(updatedChallenges)) {
        console.warn("❌ [CHALLENGE STORE] Invalid challenge updates format:", updatedChallenges);
        return;
      }
      
      if (updatedChallenges.length === 0) {
        console.log("⚠️ [CHALLENGE STORE] No challenges to update");
        return;
      }
      
      // Update challenges in store immediately (real-time, no API call needed)
      console.log("🔄 [CHALLENGE STORE] Updating challenges in store...");
      get().updateChallenges(updatedChallenges);
      
      // Verify update worked
      console.log("✅ [CHALLENGE STORE] After update - daily:", get().dailyChallenges.length, "lifetime:", get().lifetimeChallenges.length);
      
      // Show toast for completed challenges
      updatedChallenges.forEach(challenge => {
        if (challenge && challenge.completed) {
          toast.success(`🎉 Challenge completed: ${challenge.title}!`);
        }
      });
    };
    
    // Set up challenge reversal listener
    const handleChallengeReversal = (reversalData) => {
      console.log("⚠️ [CHALLENGE STORE] Challenge rewards reversed:", reversalData);
      set({ challengeReversal: { ...reversalData, hasReversals: true } });
      
      // Refresh challenges to get updated progress
      get().getMyChallenges();
    };
    
    socket.on("challenge-updated", handleChallengeUpdate);
    socket.on("challenge-reversed", handleChallengeReversal);
    
    console.log("✅ Challenge socket listener initialized on socket:", socket.id);
  },

  // Refresh daily challenges
  refreshDailyChallenges: async (updatePoints) => {
    try {
      set({ isChallengesLoading: true });

      const response = await axiosInstance.post("/challenge/reset-daily");

      if (response.data.success) {
        // Update points if provided and the backend sent new value
        if (updatePoints && response.data.points !== undefined) {
          updatePoints(response.data.points);
        }

        // Force refresh to pull the reset progress
        await get().getMyChallenges(true);
        // Also refresh daily challenges to update the display
        await get().getDailyChallenges();

        return {
          success: true,
          message: "Daily challenges refreshed successfully",
        };
      }

      return response.data;
    } catch (error) {
      console.error("Failed to refresh daily challenges:", error);
      throw error;
    } finally {
      set({ isChallengesLoading: false });
    }
  },
  
  // Clean up socket listener
  cleanupSocketListener: (socket) => {
    if (socket) {
      socket.off("challenge-updated");
      socket.off("challenge-reversed");
      console.log("🧹 Challenge socket listener cleaned up");
    }
  },
  
  // Clear challenge reversal (called when modal is closed)
  clearChallengeReversal: () => {
    set({ challengeReversal: null });
  },
  
  // Refresh challenges (wrapper for getMyChallenges)
  refreshChallenges: async () => {
    await get().getMyChallenges();
  },
  
  // Update a challenge in real-time
  updateChallenge: (updatedChallenge) => {
    if (!updatedChallenge || !updatedChallenge._id) {
      console.warn("❌ [STORE] Invalid challenge update:", updatedChallenge);
      return;
    }
    
    const { dailyChallenges, lifetimeChallenges } = get();
    const challengeId = updatedChallenge._id.toString();
    
    console.log(`🔄 [STORE] Updating challenge ${challengeId} "${updatedChallenge.title}"`);
    console.log(`🔄 [STORE] New progress: ${updatedChallenge.current}/${updatedChallenge.target}`);
    
    let found = false;
    let updated = false;
    
    // Update in daily challenges
    const updatedDaily = dailyChallenges.map(c => {
      const cId = c._id?.toString();
      if (cId === challengeId) {
        found = true;
        const oldCurrent = c.current || 0;
        const newChallenge = { ...c, ...updatedChallenge };
        // Always update if current changed (for real-time updates)
        if (newChallenge.current !== oldCurrent || newChallenge.completed !== c.completed) {
          updated = true;
          console.log(`🔄 [STORE] Updating daily challenge "${updatedChallenge.title}": ${oldCurrent} → ${newChallenge.current}/${newChallenge.target}`);
          return newChallenge;
        }
        return c;
      }
      return c;
    });
    
    // Update in lifetime challenges
    const updatedLifetime = lifetimeChallenges.map(c => {
      const cId = c._id?.toString();
      if (cId === challengeId) {
        found = true;
        const oldCurrent = c.current || 0;
        const newChallenge = { ...c, ...updatedChallenge };
        // Always update if current changed (for real-time updates)
        if (newChallenge.current !== oldCurrent || newChallenge.completed !== c.completed) {
          updated = true;
          console.log(`🔄 [STORE] Updating lifetime challenge "${updatedChallenge.title}": ${oldCurrent} → ${newChallenge.current}/${newChallenge.target}`);
          return newChallenge;
        }
        return c;
      }
      return c;
    });
    
    // If challenge not found in existing lists, add it based on type
    if (!found && updatedChallenge.type) {
      console.log(`➕ [STORE] Adding new challenge "${updatedChallenge.title}" (${updatedChallenge.type})`);
      if (updatedChallenge.type === "daily") {
        updatedDaily.push(updatedChallenge);
        updated = true;
      } else if (updatedChallenge.type === "lifetime") {
        updatedLifetime.push(updatedChallenge);
        updated = true;
      }
    }
    
    // Always update state to trigger re-render (Zustand will handle optimization)
    if (updated || !found) {
      set({ 
        dailyChallenges: [...updatedDaily], // Create new array to trigger re-render
        lifetimeChallenges: [...updatedLifetime] // Create new array to trigger re-render
      });
      console.log(`✅ [STORE] Challenge store updated! Daily: ${updatedDaily.length}, Lifetime: ${updatedLifetime.length}`);
    } else {
      console.log(`⚠️ [STORE] No changes detected for challenge "${updatedChallenge.title}"`);
    }
  },
  
  // Update multiple challenges at once
  updateChallenges: (updatedChallenges) => {
    if (!Array.isArray(updatedChallenges)) {
      console.warn("updateChallenges received non-array:", updatedChallenges);
      return;
    }
    
    updatedChallenges.forEach(challenge => {
      if (challenge && challenge._id) {
        get().updateChallenge(challenge);
      }
    });
  },

  getDailyChallenges: async () => {
    set({ isChallengesLoading: true });
    try {
      const res = await axiosInstance.get("/challenge/daily");
      console.log("Daily challenges response:", res.data);
      set({ dailyChallenges: res.data || [] });
    } catch (error) {
      console.error("Failed to fetch daily challenges:", error);
      console.error("Error details:", error.response?.data);
      toast.error("Failed to load daily challenges");
      set({ dailyChallenges: [] });
    } finally {
      set({ isChallengesLoading: false });
    }
  },

  getMyChallenges: async (forceRefresh = false) => {
    const { dailyChallenges, lifetimeChallenges } = get();
    
    // If we already have data and not forcing a refresh, return the current state
    if (!forceRefresh && dailyChallenges.length > 0 && lifetimeChallenges.length > 0) {
      return { daily: dailyChallenges, lifetime: lifetimeChallenges };
    }

    try {
      set({ isChallengesLoading: true });
      const [dailyRes, myChallengesRes] = await Promise.all([
        axiosInstance.get("/challenge/daily"),
        axiosInstance.get("/challenge/my-challenges")
      ]);
      
      // Process daily challenges
      const daily = Array.isArray(dailyRes.data) ? dailyRes.data : [];
      
      // Process lifetime challenges from my-challenges endpoint
      const lifetime = [];
      const myChallenges = Array.isArray(myChallengesRes.data) ? myChallengesRes.data : [];
      
      myChallenges.forEach(challenge => {
        if (challenge.type === "lifetime") {
          lifetime.push(challenge);
        }
      });
      
      set({ 
        dailyChallenges: daily,
        lifetimeChallenges: lifetime 
      });
      
      return { daily, lifetime };
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
      toast.error(error.response?.data?.message || "Failed to load challenges");
      return { daily: [], lifetime: [] };
    } finally {
      set({ isChallengesLoading: false });
    }
  },
  
  initLifetimeChallenges: async () => {
    try {
      await axiosInstance.post("/challenge/init-lifetime");
      get().getMyChallenges();
    } catch (error) {
      console.error("Failed to initialize lifetime challenges:", error);
    }
  },
}));

 