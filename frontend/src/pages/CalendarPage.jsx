import Calendar from "../components/Calendar";

const CalendarPage = () => {
  return (
    <div className="h-screen bg-base-200 pt-20">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Calendar</h1>
          <p className="text-base-content/60">
            Track your activity streak - spend 5-10 minutes daily to maintain your streak
          </p>
        </div>
        <Calendar />
      </div>
    </div>
  );
};

export default CalendarPage;

