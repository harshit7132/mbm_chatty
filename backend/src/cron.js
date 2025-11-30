import cron from "node-cron";
import Challenge from "./models/challenge.model.js";
import { io } from "./lib/socket.js";

// Reset daily challenges at midnight IST (18:30 UTC)
const resetDailyChallenges = cron.schedule('30 18 * * *', async () => {
  try {
    console.log('⏰ [CRON] Resetting daily challenges...');
    
    // Reset all daily challenges
    const result = await Challenge.updateMany(
      { type: "daily" },
      { 
        $set: { 
          current: 0, 
          completed: false,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`✅ [CRON] Reset ${result.modifiedCount} daily challenges`);
    
    // Notify all connected clients
    if (io) {
      io.emit('daily-challenges-reset', { 
        message: 'Daily challenges have been reset!',
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('❌ [CRON] Error resetting daily challenges:', error);
  }
}, {
  timezone: "Asia/Kolkata",
  scheduled: true
});

export default resetDailyChallenges;
