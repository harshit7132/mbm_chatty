import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import CalendarEvent from "../models/calendar.model.js";
import User from "../models/user.model.js";

const router = express.Router();

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Helper function to ensure all past days in a month are tracked in MongoDB
const ensureMonthActivityTracked = async (user, startDate, endDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!user.dailyActivity) {
    user.dailyActivity = [];
  }

  const activityMap = new Map();
  user.dailyActivity.forEach(activity => {
    const activityDate = new Date(activity.date);
    activityDate.setHours(0, 0, 0, 0);
    const dateStr = activityDate.toISOString().split('T')[0];
    activityMap.set(dateStr, activity);
  });

  // Check all dates in the month and mark past inactive days
  const currentDate = new Date(startDate);
  let hasChanges = false;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const checkDate = new Date(currentDate);
    checkDate.setHours(0, 0, 0, 0);
    
    // Only mark past dates (not today or future)
    if (checkDate < today && !activityMap.has(dateStr)) {
      // This is a past date with no activity - mark as inactive in MongoDB
      user.dailyActivity.push({
        date: checkDate,
        loginTime: null,
        activeMinutes: 0,
        isActive: false, // Explicitly mark as inactive
      });
      activityMap.set(dateStr, { isActive: false, activeMinutes: 0 });
      hasChanges = true;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (hasChanges) {
    await user.save();
  }

  return user.dailyActivity;
};

// Get calendar for a specific month
router.get("/month/:year/:month", protectRoute, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user._id;

    // Validate month (0-11 for JavaScript Date)
    const monthNum = parseInt(month) - 1; // Convert to 0-based
    const yearNum = parseInt(year);

    if (monthNum < 0 || monthNum > 11 || isNaN(yearNum)) {
      return res.status(400).json({ message: "Invalid month or year" });
    }

    // Get start and end of month
    const startDate = new Date(yearNum, monthNum, 1);
    const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59, 999);

    // Get all calendar events for this month
    const events = await CalendarEvent.find({
      date: { $gte: startDate, $lte: endDate },
      isActive: true,
    }).sort({ date: 1 });

    // Get user's data including calendar claims and daily activity
    const user = await User.findById(userId).select("calendarClaims dailyActivity loginStreak lastLoginDate consecutiveDaysActive");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure all past days in this month are tracked in MongoDB (mark inactive days)
    const dailyActivity = await ensureMonthActivityTracked(user, startDate, endDate);
    const claimedDates = user?.calendarClaims || [];
    
    // Filter to only this month's claims
    const monthClaims = claimedDates.filter(claim => {
      const claimDate = new Date(claim.date);
      return claimDate >= startDate && claimDate <= endDate;
    });

    // Filter to only this month's activity (now includes both active and inactive days from MongoDB)
    const monthActivity = dailyActivity.filter(activity => {
      const activityDate = new Date(activity.date);
      return activityDate >= startDate && activityDate <= endDate;
    });

    // Create maps for quick lookup
    const claimedDatesMap = new Map();
    monthClaims.forEach(claim => {
      const dateStr = new Date(claim.date).toISOString().split('T')[0];
      claimedDatesMap.set(dateStr, claim);
    });

    const activityMap = new Map();
    monthActivity.forEach(activity => {
      const dateStr = new Date(activity.date).toISOString().split('T')[0];
      activityMap.set(dateStr, activity);
    });

    // Get all dates in the month
    const allDatesInMonth = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // Use local date components to avoid timezone issues
      const yearLocal = currentDate.getFullYear();
      const monthLocal = currentDate.getMonth() + 1;
      const dayLocal = currentDate.getDate();
      const dateStr = `${yearLocal}-${String(monthLocal).padStart(2, '0')}-${String(dayLocal).padStart(2, '0')}`;
      const day = dayLocal;
      
      // Check if there's a calendar event for this date
      const event = events.find(e => {
        const eventDateStr = new Date(e.date).toISOString().split('T')[0];
        return eventDateStr === dateStr;
      });

      // Get activity from MongoDB (already stored with isActive flag)
      const activity = activityMap.get(dateStr);
      const isActive = activity?.isActive === true; // Explicitly check for true
      const activeMinutes = activity?.activeMinutes || 0;

      // Determine emoji based on activity stored in MongoDB
      let emoji = null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(currentDate);
      checkDate.setHours(0, 0, 0, 0);
      
      if (isActive) {
        emoji = "🔥"; // Active day (from MongoDB: isActive = true)
      } else if (checkDate < today) {
        emoji = "😭"; // Missed day (from MongoDB: isActive = false and date has passed)
      }
      // Future days (no emoji) - not yet tracked in MongoDB

      allDatesInMonth.push({
        date: dateStr,
        day: day,
        isToday: dateStr === new Date().toISOString().split('T')[0],
        emoji: emoji,
        isActive: isActive,
        activeMinutes: activeMinutes,
        // Calendar event data if exists
        event: event ? {
          _id: event._id,
          points: event.points,
          title: event.title,
          description: event.description,
          isClaimed: claimedDatesMap.has(dateStr),
          claimedAt: claimedDatesMap.has(dateStr) ? claimedDatesMap.get(dateStr).claimedAt : null,
        } : null,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Format response - all data from MongoDB
    const calendarData = {
      year: yearNum,
      month: monthNum + 1, // Convert back to 1-based
      loginStreak: user?.loginStreak || 0, // From MongoDB
      consecutiveDaysActive: user?.consecutiveDaysActive || 0, // From MongoDB
      lastLoginDate: user?.lastLoginDate || null, // From MongoDB
      dates: allDatesInMonth, // All activity data from MongoDB
      // Keep events array for backward compatibility
      events: events.map(event => {
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toISOString().split('T')[0];
        const isClaimed = claimedDatesMap.has(dateStr);
        
        return {
          _id: event._id,
          date: dateStr,
          day: eventDate.getDate(),
          points: event.points,
          title: event.title,
          description: event.description,
          isClaimed,
          claimedAt: isClaimed ? claimedDatesMap.get(dateStr).claimedAt : null,
        };
      }),
    };

    res.status(200).json(calendarData);
  } catch (error) {
    console.error("Error fetching calendar:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Claim points for a specific date
router.post("/claim/:date", protectRoute, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user._id;

    // Parse date (format: YYYY-MM-DD)
    const claimDate = new Date(date);
    if (isNaN(claimDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Set to start of day for comparison
    const dateStart = new Date(claimDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(claimDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Find calendar event for this date
    const event = await CalendarEvent.findOne({
      date: { $gte: dateStart, $lte: dateEnd },
      isActive: true,
    });

    if (!event) {
      return res.status(404).json({ message: "No reward available for this date" });
    }

    // Check if user already claimed this date
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.calendarClaims) {
      user.calendarClaims = [];
    }

    const dateStr = dateStart.toISOString().split('T')[0];
    const alreadyClaimed = user.calendarClaims.some(claim => {
      const claimDateStr = new Date(claim.date).toISOString().split('T')[0];
      return claimDateStr === dateStr;
    });

    if (alreadyClaimed) {
      return res.status(400).json({ message: "Reward already claimed for this date" });
    }

    // Award points
    const pointsToAward = event.points;
    user.points = (user.points || 0) + pointsToAward;
    user.totalPoints = (user.totalPoints || 0) + pointsToAward;
    
    // Add to calendar claims
    user.calendarClaims.push({
      date: dateStart,
      points: pointsToAward,
      eventId: event._id,
      claimedAt: new Date(),
    });

    // Add to points history
    user.pointsHistory.push({
      type: "earned",
      amount: pointsToAward,
      description: `Calendar reward: ${event.title} (${dateStr})`,
      timestamp: new Date(),
    });

    await user.save();

    // Emit socket event for real-time points update
    if (req.app.get("io")) {
      req.app.get("io").to(userId.toString()).emit("points-updated", { 
        points: user.points,
      });
    }

    res.status(200).json({
      message: "Reward claimed successfully",
      points: pointsToAward,
      totalPoints: user.points,
      date: dateStr,
    });
  } catch (error) {
    console.error("Error claiming calendar reward:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Create calendar event
router.post("/admin/event", protectRoute, isAdmin, async (req, res) => {
  try {
    const { date, points, title, description } = req.body;

    if (!date || !points || !title) {
      return res.status(400).json({ message: "Date, points, and title are required" });
    }

    const eventDate = new Date(date);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Set to start of day
    eventDate.setHours(0, 0, 0, 0);

    // Check if event already exists for this date
    const existingEvent = await CalendarEvent.findOne({
      date: {
        $gte: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()),
        $lt: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1),
      },
    });

    if (existingEvent) {
      // Update existing event
      existingEvent.points = points;
      existingEvent.title = title;
      existingEvent.description = description || "";
      existingEvent.isActive = true;
      await existingEvent.save();

      return res.status(200).json({
        message: "Calendar event updated",
        event: existingEvent,
      });
    }

    // Create new event
    const event = await CalendarEvent.create({
      date: eventDate,
      points: parseInt(points),
      title,
      description: description || "",
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Calendar event created successfully",
      event,
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Get all calendar events
router.get("/admin/events", protectRoute, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const events = await CalendarEvent.find(query)
      .sort({ date: 1 })
      .populate("createdBy", "fullName email");

    res.status(200).json({ events });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Update calendar event
router.put("/admin/event/:eventId", protectRoute, isAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { date, points, title, description, isActive } = req.body;

    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Calendar event not found" });
    }

    if (date !== undefined) {
      const eventDate = new Date(date);
      eventDate.setHours(0, 0, 0, 0);
      event.date = eventDate;
    }
    if (points !== undefined) event.points = parseInt(points);
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (isActive !== undefined) event.isActive = Boolean(isActive);

    await event.save();

    res.status(200).json({
      message: "Calendar event updated successfully",
      event,
    });
  } catch (error) {
    console.error("Error updating calendar event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Delete calendar event
router.delete("/admin/event/:eventId", protectRoute, isAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await CalendarEvent.findByIdAndDelete(eventId);
    if (!event) {
      return res.status(404).json({ message: "Calendar event not found" });
    }

    res.status(200).json({ message: "Calendar event deleted successfully" });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;

