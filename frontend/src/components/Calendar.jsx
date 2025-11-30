import { useEffect, useState, useCallback } from "react";
import { axiosInstance } from "../lib/axios";
import { ChevronLeft, ChevronRight, Gift, Flame } from "lucide-react";
import toast from "react-hot-toast";

const Calendar = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-based

  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/calendar/month/${year}/${month}`);
      setCalendarData(response.data);
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
      toast.error("Failed to load calendar");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleClaimReward = async (date) => {
    if (isClaiming) return;
    
    setIsClaiming(true);
    try {
      const response = await axiosInstance.post(`/calendar/claim/${date}`);
      toast.success(`Claimed ${response.data.points} points!`);
      // Refresh calendar data
      await fetchCalendarData();
    } catch (error) {
      console.error("Failed to claim reward:", error);
      toast.error(error.response?.data?.message || "Failed to claim reward");
    } finally {
      setIsClaiming(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (isLoading && !calendarData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!calendarData) {
    return (
      <div className="text-center p-8">
        <p className="text-base-content/60">No calendar data available</p>
      </div>
    );
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get first day of month to determine offset
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Create calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = calendarData.dates.find(d => d.date === dateStr);
    // Ensure day number is correct (use local day, not from backend)
    calendarDays.push({
      ...(dayData || {}), // Spread dayData first
      day, // Override with correct local day number (1 to daysInMonth)
      dateStr, // Ensure dateStr matches
    });
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header with month navigation and streak */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="btn btn-sm btn-ghost btn-circle"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold">
              {monthNames[month - 1]} {year}
            </h2>
            <button
              onClick={goToToday}
              className="btn btn-xs btn-ghost mt-1"
            >
              Go to Today
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            className="btn btn-sm btn-ghost btn-circle"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Login Streak Display */}
        <div className="flex items-center gap-2 bg-base-200 px-4 py-2 rounded-lg">
          <Flame className="w-5 h-5 text-orange-500" />
          <div>
            <div className="text-xs text-base-content/60">Login Streak</div>
            <div className="text-lg font-bold">{calendarData.loginStreak || 0} days</div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-base-100 rounded-lg shadow-lg p-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-base-content/70 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((dayData, index) => {
            if (!dayData) {
              return <div key={`empty-${index}`} className="aspect-square"></div>;
            }

            const { day, dateStr, isToday, emoji, isActive, event, activeMinutes } = dayData;
            const isPast = new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);

            return (
              <div
                key={dateStr}
                className={`
                  aspect-square border rounded-lg p-2 flex flex-col items-center justify-center
                  transition-all cursor-pointer
                  ${isToday ? 'ring-2 ring-primary bg-primary/10' : ''}
                  ${isActive ? 'bg-success/10 border-success/30' : ''}
                  ${!isActive && isPast ? 'bg-error/10 border-error/30 opacity-60' : ''}
                  ${!isActive && !isPast ? 'bg-base-200 border-base-300' : ''}
                  hover:scale-105 hover:shadow-md
                `}
                title={
                  event
                    ? `${event.title}: ${event.points} points ${event.isClaimed ? '(Claimed)' : '(Click to claim)'}`
                    : isActive
                    ? `Active: ${activeMinutes} minutes`
                    : isPast
                    ? "Missed day"
                    : "Future day"
                }
                onClick={() => {
                  if (event && !event.isClaimed && !isClaiming) {
                    handleClaimReward(dateStr);
                  }
                }}
              >
                {/* Day number */}
                <div className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {day}
                </div>

                {/* Emoji */}
                {emoji && (
                  <div className="text-2xl mt-1">
                    {emoji}
                  </div>
                )}

                {/* Event indicator */}
                {event && (
                  <div className="mt-1 flex items-center gap-1">
                    <Gift className={`w-3 h-3 ${event.isClaimed ? 'text-success' : 'text-warning'}`} />
                    {event.isClaimed ? (
                      <span className="text-xs text-success">✓</span>
                    ) : (
                      <span className="text-xs text-warning">{event.points}</span>
                    )}
                  </div>
                )}

                {/* Active minutes indicator */}
                {isActive && activeMinutes > 0 && (
                  <div className="text-xs text-success mt-1">
                    {activeMinutes}m
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success/10 border border-success/30"></div>
          <span>Active day (🔥)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-error/10 border border-error/30"></div>
          <span>Missed day (😭)</span>
        </div>
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-warning"></Gift>
          <span>Special event (click to claim)</span>
        </div>
      </div>
    </div>
  );
};

export default Calendar;

