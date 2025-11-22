import AIChat from "../components/AIChat";

const AIChatPage = () => {
  return (
    <div className="h-screen bg-base-200 pt-20">
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-5rem)]">
        <div className="bg-base-100 rounded-lg shadow-lg h-full">
          <AIChat />
        </div>
      </div>
    </div>
  );
};

export default AIChatPage;

