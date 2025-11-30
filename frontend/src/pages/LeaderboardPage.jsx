import Leaderboard from "../components/Leaderboard";

const LeaderboardPage = () => {
  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-6 overflow-y-auto">
      <div className="container mx-auto px-4 py-6">
        <Leaderboard />
      </div>
    </div>
  );
};

export default LeaderboardPage;

