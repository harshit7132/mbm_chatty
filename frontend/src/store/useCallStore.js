import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

export const useCallStore = create((set, get) => ({
  activeCall: null,
  incomingCall: null,

  setActiveCall: (callData) => set({ activeCall: callData }),
  setIncomingCall: (callData) => set({ incomingCall: callData }),
  clearCall: () => set({ activeCall: null, incomingCall: null }),

  answerCall: async () => {
    const { incomingCall } = get();
    if (incomingCall) {
      const socket = useAuthStore.getState().socket;
      
      // Mark call as accepted and set it as active
      const acceptedCall = {
        ...incomingCall,
        isIncoming: true, // Mark as incoming call that was accepted
      };
      
      // Emit call acceptance
      socket.emit("call-accept", {
        targetUserId: incomingCall.fromUserId,
        callId: incomingCall.callId,
        answer: true,
      });
      
      // Set as active call - VideoCall component will initialize
      set({ activeCall: acceptedCall, incomingCall: null });
    }
  },

  rejectCall: () => {
    const { incomingCall } = get();
    if (incomingCall) {
      const socket = useAuthStore.getState().socket;
      socket.emit("call-accept", {
        targetUserId: incomingCall.fromUserId,
        callId: incomingCall.callId,
        answer: false,
      });
      set({ incomingCall: null });
    }
  },
}));

