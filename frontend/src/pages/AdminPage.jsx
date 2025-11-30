import { useEffect, useState, useRef } from "react";
import { useAdminStore } from "../store/useAdminStore";
import { useAuthStore } from "../store/useAuthStore";
import { Users, MessageSquare, Trash2, Shield, Target, Plus, Edit, X, ShoppingCart, Calendar } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const AdminPage = () => {
  const {
    dashboardStats,
    allUsers,
    getDashboardStats,
    getAllUsers,
    deleteUser,
    makeAdmin,
    isAdminLoading,
  } = useAdminStore();
  const { authUser } = useAuthStore();
  const [challenges, setChallenges] = useState([]);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const isSubmittingRef = useRef(false);
  const lastSubmissionRef = useRef(null);
  const [challengeForm, setChallengeForm] = useState({
    title: "",
    description: "",
    type: "daily",
    points: 0,
    target: 1,
    category: "custom",
    startDate: "",
    endDate: "",
    isActive: true,
    challengeData: null,
    timeLimit: null,
  });
  const [pricingPackages, setPricingPackages] = useState([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState({
    title: "",
    points: 0,
    rupees: 0,
    discount: 0,
    displayOrder: 0,
    isActive: true,
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [calendarForm, setCalendarForm] = useState({
    date: "",
    points: 0,
    title: "",
    description: "",
    isActive: true,
  });

  useEffect(() => {
    if (authUser?.isAdmin) {
      getDashboardStats();
      getAllUsers();
      fetchChallenges();
      fetchPricingPackages();
      fetchCalendarEvents();
    }
  }, [authUser, getDashboardStats, getAllUsers]);

  const fetchChallenges = async () => {
    try {
      const res = await axiosInstance.get("/challenge/all");
      // Structure: { templates, userProgress, oldChallenges }
      // Combine templates and old challenges for display, ensuring unique IDs
      const allChallenges = [];
      const seenIds = new Set();
      
      // Add templates first
      if (res.data.templates && Array.isArray(res.data.templates)) {
        res.data.templates.forEach(template => {
          const id = template._id?.toString();
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            allChallenges.push(template);
          }
        });
      }
      
      // Add old challenges from MongoDB (without challengeId) - only if not already seen
      if (res.data.oldChallenges && Array.isArray(res.data.oldChallenges)) {
        res.data.oldChallenges.forEach(oldChallenge => {
          const id = oldChallenge._id?.toString();
          // Only add if it's truly an old challenge (no matching template) and unique
          if (id && !seenIds.has(id)) {
            // Check if there's already a template with the same title and type
            const hasMatchingTemplate = allChallenges.some(
              c => c.title === oldChallenge.title && c.type === oldChallenge.type && !c.isOldChallenge
            );
            if (!hasMatchingTemplate) {
              seenIds.add(id);
              allChallenges.push(oldChallenge);
            }
          }
        });
      }
      
      // Fallback for backward compatibility
      if (allChallenges.length === 0 && Array.isArray(res.data)) {
        res.data.forEach(challenge => {
          const id = challenge._id?.toString();
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            allChallenges.push(challenge);
          }
        });
      }
      
      setChallenges(allChallenges);
      console.log(`Loaded ${allChallenges.length} challenges (${res.data.templates?.length || 0} templates, ${res.data.oldChallenges?.length || 0} old)`);
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
    }
  };

  const handleCreateChallenge = async (e) => {
    // Don't submit if Enter was pressed in a textarea
    // Check both the event target and active element
    const target = e.target || (e.nativeEvent && e.nativeEvent.target);
    const activeElement = document.activeElement;
    
    if ((target && target.tagName === "TEXTAREA") || 
        (activeElement && activeElement.tagName === "TEXTAREA")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double submission using ref (more reliable in StrictMode)
    if (isSubmittingRef.current) {
      console.log("⚠️ [CHALLENGE FORM] Submission already in progress, ignoring duplicate call");
      return;
    }
    
    // Capture form data at submission time to prevent stale values
    const formData = { ...challengeForm };
    
    // Create a unique submission ID to detect duplicates
    const submissionId = `${Date.now()}-${Math.random()}`;
    const submissionKey = `${formData.title}-${formData.type}-${formData.points}-${formData.target}`;
    
    // Check if this exact submission was just made (within last 2 seconds)
    if (lastSubmissionRef.current && 
        lastSubmissionRef.current.key === submissionKey && 
        Date.now() - lastSubmissionRef.current.timestamp < 2000) {
      console.log("⚠️ [CHALLENGE FORM] Duplicate submission detected, ignoring:", submissionKey);
      return;
    }
    
    console.log("📝 [CHALLENGE FORM] Form submission with data:", formData, "Submission ID:", submissionId);
    
    // Validate form data before submission - check for null/undefined explicitly
    if (!formData.title || !formData.type || formData.points === undefined || formData.points === null || !formData.target) {
      console.log("❌ [CHALLENGE FORM] Validation failed:", formData);
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Validate points is a valid number and > 0
    const pointsNum = Number(formData.points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      console.log("❌ [CHALLENGE FORM] Invalid points:", formData.points);
      toast.error("Points must be a valid number greater than 0");
      return;
    }
    
    // Record this submission
    lastSubmissionRef.current = {
      key: submissionKey,
      timestamp: Date.now(),
      id: submissionId
    };
    
    isSubmittingRef.current = true;
    setIsSubmittingChallenge(true);
    
    try {
      if (editingChallenge) {
        console.log("📝 [CHALLENGE FORM] Updating challenge:", editingChallenge._id);
        await axiosInstance.put(`/challenge/${editingChallenge._id}`, formData);
        toast.success("Challenge updated successfully");
      } else {
        console.log("📝 [CHALLENGE FORM] Creating new challenge");
        await axiosInstance.post("/challenge/create", formData);
        toast.success("Challenge created successfully");
      }
      setShowChallengeModal(false);
      setEditingChallenge(null);
      setChallengeForm({
        title: "",
        description: "",
        type: "daily",
        points: 0,
        target: 1,
        category: "custom",
        startDate: "",
        endDate: "",
        isActive: true,
        challengeData: null,
        timeLimit: null,
      });
      fetchChallenges();
    } catch (error) {
      console.error("❌ [CHALLENGE FORM] Error:", error);
      toast.error(error.response?.data?.message || "Failed to save challenge");
    } finally {
      // Add a small delay before resetting to prevent rapid re-submissions
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmittingChallenge(false);
        // Keep lastSubmissionRef for 2 seconds to prevent duplicates
        setTimeout(() => {
          if (lastSubmissionRef.current?.id === submissionId) {
            lastSubmissionRef.current = null;
          }
        }, 2000);
      }, 500);
    }
  };

  const handleEditChallenge = (challenge) => {
    setEditingChallenge(challenge);
    setChallengeForm({
      title: challenge.title,
      description: challenge.description || "",
      type: challenge.type,
      points: challenge.points,
      target: challenge.target,
      category: challenge.category || "custom",
      startDate: challenge.startDate ? new Date(challenge.startDate).toISOString().split("T")[0] : "",
      endDate: challenge.endDate ? new Date(challenge.endDate).toISOString().split("T")[0] : "",
      isActive: challenge.isActive,
      challengeData: challenge.challengeData || null,
      timeLimit: challenge.timeLimit || null,
    });
    setShowChallengeModal(true);
  };

  const handleDeleteChallenge = async (challengeId) => {
    if (!confirm("Are you sure you want to delete this challenge?")) return;
    try {
      await axiosInstance.delete(`/challenge/${challengeId}`);
      toast.success("Challenge deleted successfully");
      fetchChallenges();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete challenge");
    }
  };

  const fetchPricingPackages = async () => {
    try {
      const res = await axiosInstance.get("/payment/admin/packages");
      setPricingPackages(res.data.packages || []);
    } catch (error) {
      console.error("Failed to fetch pricing packages:", error);
      toast.error("Failed to fetch pricing packages");
    }
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        await axiosInstance.put(`/payment/admin/packages/${editingPackage._id}`, packageForm);
        toast.success("Package updated successfully");
      } else {
        await axiosInstance.post("/payment/admin/packages", packageForm);
        toast.success("Package created successfully");
      }
      setShowPackageModal(false);
      setEditingPackage(null);
      setPackageForm({
        title: "",
        points: 0,
        rupees: 0,
        discount: 0,
        displayOrder: 0,
        isActive: true,
      });
      fetchPricingPackages();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save package");
    }
  };

  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setPackageForm({
      title: pkg.title,
      points: pkg.points,
      rupees: pkg.rupees,
      discount: pkg.discount || 0,
      displayOrder: pkg.displayOrder || 0,
      isActive: pkg.isActive,
    });
    setShowPackageModal(true);
  };

  const handleDeletePackage = async (packageId) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      await axiosInstance.delete(`/payment/admin/packages/${packageId}`);
      toast.success("Package deleted successfully");
      fetchPricingPackages();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete package");
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const res = await axiosInstance.get("/calendar/admin/events");
      setCalendarEvents(res.data.events || []);
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
      toast.error("Failed to fetch calendar events");
    }
  };

  const handleCreateCalendarEvent = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await axiosInstance.put(`/calendar/admin/event/${editingEvent._id}`, calendarForm);
        toast.success("Calendar event updated successfully");
      } else {
        await axiosInstance.post("/calendar/admin/event", calendarForm);
        toast.success("Calendar event created successfully");
      }
      setShowCalendarModal(false);
      setEditingEvent(null);
      setCalendarForm({
        date: "",
        points: 0,
        title: "",
        description: "",
        isActive: true,
      });
      fetchCalendarEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save calendar event");
    }
  };

  const handleEditCalendarEvent = (event) => {
    setEditingEvent(event);
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toISOString().split('T')[0];
    setCalendarForm({
      date: dateStr,
      points: event.points,
      title: event.title,
      description: event.description || "",
      isActive: event.isActive,
    });
    setShowCalendarModal(true);
  };

  const handleDeleteCalendarEvent = async (eventId) => {
    if (!confirm("Are you sure you want to delete this calendar event?")) return;
    try {
      await axiosInstance.delete(`/calendar/admin/event/${eventId}`);
      toast.success("Calendar event deleted successfully");
      fetchCalendarEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete calendar event");
    }
  };

  if (!authUser?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-4 text-error" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-base-content/70">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat bg-base-200 rounded-lg shadow">
            <div className="stat-figure text-primary">
              <Users size={32} />
            </div>
            <div className="stat-title">Total Users</div>
            <div className="stat-value text-primary">{dashboardStats.totalUsers}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg shadow">
            <div className="stat-figure text-secondary">
              <MessageSquare size={32} />
            </div>
            <div className="stat-title">Total Messages</div>
            <div className="stat-value text-secondary">{dashboardStats.totalMessages}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg shadow">
            <div className="stat-figure text-accent">
              <Shield size={32} />
            </div>
            <div className="stat-title">Admins</div>
            <div className="stat-value text-accent">{dashboardStats.totalAdmins}</div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-lg mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">Challenges</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingChallenge(null);
                setChallengeForm({
                  title: "",
                  description: "",
                  type: "daily",
                  points: 0,
                  target: 1,
                  category: "custom",
                  startDate: "",
                  endDate: "",
                  isActive: true,
                });
                setShowChallengeModal(true);
              }}
            >
              <Plus size={18} className="mr-2" />
              Create Challenge
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Points</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((challenge) => {
                  // Create a unique key that combines ID with type to prevent duplicates
                  const uniqueKey = challenge.isOldChallenge 
                    ? `old-${challenge._id}` 
                    : `template-${challenge._id}`;
                  return (
                  <tr key={uniqueKey}>
                    <td>
                      <div>
                        <div className="font-medium">{challenge.title}</div>
                        {challenge.description && (
                          <div className="text-sm opacity-70">{challenge.description}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-sm">
                        {challenge.type === "daily" ? "Daily" : "Lifetime"}
                      </span>
                    </td>
                    <td>{challenge.points}</td>
                    <td>{challenge.target}</td>
                    <td>
                      {challenge.isActive ? (
                        <span className="badge badge-success badge-sm">Active</span>
                      ) : (
                        <span className="badge badge-error badge-sm">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => handleEditChallenge(challenge)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-xs btn-error"
                          onClick={() => handleDeleteChallenge(challenge._id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {challenges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-base-content/70">
                      No challenges yet. Create one to get started!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-lg mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">Pricing Packages</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingPackage(null);
                setPackageForm({
                  title: "",
                  points: 0,
                  rupees: 0,
                  discount: 0,
                  displayOrder: 0,
                  isActive: true,
                });
                setShowPackageModal(true);
              }}
            >
              <Plus size={18} className="mr-2" />
              Create Package
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Points</th>
                  <th>Price (₹)</th>
                  <th>Discount</th>
                  <th>Final Price</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pricingPackages.map((pkg) => {
                  const finalPrice = pkg.discount > 0
                    ? pkg.rupees - (pkg.rupees * pkg.discount) / 100
                    : pkg.rupees;
                  return (
                    <tr key={pkg._id}>
                      <td className="font-medium">{pkg.title}</td>
                      <td>{pkg.points}</td>
                      <td>₹{pkg.rupees}</td>
                      <td>
                        {pkg.discount > 0 ? (
                          <span className="badge badge-success badge-sm">{pkg.discount}%</span>
                        ) : (
                          <span className="text-base-content/50">-</span>
                        )}
                      </td>
                      <td className="font-bold text-primary">₹{finalPrice.toFixed(2)}</td>
                      <td>{pkg.displayOrder}</td>
                      <td>
                        {pkg.isActive ? (
                          <span className="badge badge-success badge-sm">Active</span>
                        ) : (
                          <span className="badge badge-error badge-sm">Inactive</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => handleEditPackage(pkg)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-xs btn-error"
                            onClick={() => handleDeletePackage(pkg._id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pricingPackages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-base-content/70">
                      No packages yet. Create one to get started!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h3 className="card-title mb-4">All Users</h3>
          {isAdminLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 rounded-full">
                              <img
                                src={user.profilePic || "/avatar.png"}
                                alt={user.fullName}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">{user.fullName}</div>
                            {user.badges && user.badges.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {user.badges.slice(0, 2).map((badge, idx) => (
                                  <span
                                    key={idx}
                                    className="badge badge-xs badge-primary"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {user.isAdmin ? (
                          <span className="badge badge-success">Admin</span>
                        ) : (
                          <span className="badge">User</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {!user.isAdmin && (
                            <button
                              className="btn btn-xs btn-primary"
                              onClick={() => makeAdmin(user._id)}
                            >
                              Make Admin
                            </button>
                          )}
                          {user._id !== authUser._id && (
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => {
                                if (confirm(`Delete user ${user.fullName}?`)) {
                                  deleteUser(user._id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showChallengeModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingChallenge ? "Edit Challenge" : "Create New Challenge"}
            </h3>
            <form 
              onSubmit={handleCreateChallenge}
              onKeyDown={(e) => {
                // Prevent form submission when Enter is pressed in textareas
                if (e.key === "Enter" && e.target.tagName === "TEXTAREA") {
                  // Allow Enter to work normally in textarea (create new line)
                  // But prevent form submission by stopping propagation
                  e.stopPropagation();
                  // Don't prevent default - let Enter create new line
                }
              }}
            >
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={challengeForm.description}
                  onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Type *</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={challengeForm.type}
                    onChange={(e) => setChallengeForm({ ...challengeForm, type: e.target.value })}
                    required
                  >
                    <option value="daily">Daily</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Category</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={challengeForm.category}
                    onChange={(e) => setChallengeForm({ ...challengeForm, category: e.target.value, challengeData: null })}
                  >
                    <option value="custom">Custom</option>
                    <option value="chat">Chat</option>
                    <option value="messages">Messages</option>
                    <option value="time">Time (e.g., spend X minutes/hours)</option>
                    <option value="streak">Streak (e.g., 7 days in a row)</option>
                    <option value="trivia">Trivia (with question & options)</option>
                    <option value="puzzle">Puzzle/Riddle (with answer)</option>
                    <option value="quiz">Quiz (multiple questions)</option>
                    <option value="coding">Coding Challenge</option>
                  </select>
                  <label className="label">
                    <span className="label-text-alt">
                      {challengeForm.category === "time" && "Use Target field for time duration (e.g., 30 for 30 minutes)"}
                      {challengeForm.category === "streak" && "Use Target field for streak days (e.g., 7 for 7-day streak)"}
                      {challengeForm.category === "chat" && "Chat-related challenges"}
                      {challengeForm.category === "messages" && "Message-related challenges"}
                      {challengeForm.category === "custom" && "General custom challenges"}
                      {(challengeForm.category === "trivia" || challengeForm.category === "puzzle" || challengeForm.category === "quiz" || challengeForm.category === "coding") && "Additional fields will appear below"}
                    </span>
                  </label>
                </div>
              </div>
              
              {/* Dynamic fields based on category */}
              {challengeForm.category === "trivia" && (
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-3">Trivia Question</h4>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Question *</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.question || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          question: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          // Stop propagation to prevent form submission
                          e.stopPropagation();
                          // Don't prevent default - let Enter work normally
                        }
                      }}
                      rows={2}
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Options (one per line) *</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.options?.join("\n") || ""}
                      onChange={(e) => {
                        // Store the raw value to preserve empty lines while typing
                        const rawValue = e.target.value;
                        // Only filter empty lines when processing, but keep them in the display
                        const options = rawValue.split("\n");
                        setChallengeForm({
                          ...challengeForm,
                          challengeData: {
                            ...challengeForm.challengeData,
                            options: options
                          }
                        });
                      }}
                      onKeyDown={(e) => {
                        // Allow Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          // Stop propagation to prevent form submission
                          e.stopPropagation();
                          // Don't prevent default - let Enter work normally
                        }
                      }}
                      onBlur={(e) => {
                        // Filter out empty lines only when user leaves the field
                        const options = e.target.value.split("\n").filter(o => o.trim());
                        setChallengeForm({
                          ...challengeForm,
                          challengeData: {
                            ...challengeForm.challengeData,
                            options: options
                          }
                        });
                      }}
                      rows={4}
                      placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Correct Answer (0-based index) *</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={challengeForm.challengeData?.correctAnswer ?? ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          correctAnswer: Number(e.target.value)
                        }
                      })}
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Explanation</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.explanation || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          explanation: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={2}
                    />
                  </div>
                </div>
              )}
              
              {challengeForm.category === "puzzle" && (
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-3">Puzzle/Riddle</h4>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Question/Puzzle *</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.question || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          question: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={3}
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Answer *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={challengeForm.challengeData?.answer || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          answer: e.target.value
                        }
                      })}
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Hint</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.hint || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          hint: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={2}
                    />
                  </div>
                </div>
              )}
              
              {challengeForm.category === "quiz" && (
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-3">Quiz Configuration</h4>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Time Limit (seconds)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={challengeForm.timeLimit || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        timeLimit: e.target.value ? Number(e.target.value) : null
                      })}
                      min="10"
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Questions (JSON format) *</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered font-mono text-sm"
                      value={JSON.stringify(challengeForm.challengeData?.questions || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const questions = JSON.parse(e.target.value);
                          setChallengeForm({
                            ...challengeForm,
                            challengeData: {
                              ...challengeForm.challengeData,
                              questions: questions
                            }
                          });
                        } catch (err) {
                          // Invalid JSON, don't update
                        }
                      }}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={8}
                      placeholder='[&#10;  {&#10;    "question": "What is 2+2?",&#10;    "options": ["2", "3", "4", "5"],&#10;    "correctAnswer": 2&#10;  }&#10;]'
                      required
                    />
                    <label className="label">
                      <span className="label-text-alt">Format: Array of {`{question, options: [], correctAnswer: number}`}</span>
                    </label>
                  </div>
                </div>
              )}
              
              {challengeForm.category === "coding" && (
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-3">Coding Challenge</h4>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Problem Description *</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={challengeForm.challengeData?.problem || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          problem: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={4}
                      required
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Starter Code</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered font-mono text-sm"
                      value={challengeForm.challengeData?.starterCode || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          starterCode: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={6}
                      placeholder="function solve(input) {&#10;  // Your code here&#10;}"
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Test Cases (JSON format)</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered font-mono text-sm"
                      value={JSON.stringify(challengeForm.challengeData?.testCases || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const testCases = JSON.parse(e.target.value);
                          setChallengeForm({
                            ...challengeForm,
                            challengeData: {
                              ...challengeForm.challengeData,
                              testCases: testCases
                            }
                          });
                        } catch (err) {
                          // Invalid JSON
                        }
                      }}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={6}
                      placeholder='[&#10;  { "input": "test", "expected": "result" }&#10;]'
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Solution (for reference)</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered font-mono text-sm"
                      value={challengeForm.challengeData?.solution || ""}
                      onChange={(e) => setChallengeForm({
                        ...challengeForm,
                        challengeData: {
                          ...challengeForm.challengeData,
                          solution: e.target.value
                        }
                      })}
                      onKeyDown={(e) => {
                        // Allow Enter and Shift+Enter to create new lines in textarea
                        if (e.key === "Enter") {
                          e.stopPropagation(); // Prevent form submission
                        }
                      }}
                      rows={4}
                    />
                  </div>
                </div>
              )}
              
              {(challengeForm.category === "quiz" || challengeForm.category === "trivia") && (
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Time Limit (seconds)</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={challengeForm.timeLimit || ""}
                    onChange={(e) => setChallengeForm({
                      ...challengeForm,
                      timeLimit: e.target.value ? Number(e.target.value) : null
                    })}
                    min="10"
                    placeholder="e.g., 30"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Points *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={challengeForm.points}
                    onChange={(e) => setChallengeForm({ ...challengeForm, points: Number(e.target.value) })}
                    min="0"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">
                      Target * 
                      {challengeForm.category === "time" && " (minutes/hours)"}
                      {challengeForm.category === "streak" && " (days)"}
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={challengeForm.target}
                    onChange={(e) => setChallengeForm({ ...challengeForm, target: Number(e.target.value) })}
                    min="1"
                    required
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      {challengeForm.category === "time" && "Example: 30 = 30 minutes, 60 = 1 hour"}
                      {challengeForm.category === "streak" && "Example: 7 = 7 days in a row"}
                    </span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Start Date</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={challengeForm.startDate}
                    onChange={(e) => setChallengeForm({ ...challengeForm, startDate: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">End Date</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={challengeForm.endDate}
                    onChange={(e) => setChallengeForm({ ...challengeForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={challengeForm.isActive}
                    onChange={(e) => setChallengeForm({ ...challengeForm, isActive: e.target.checked })}
                  />
                </label>
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    isSubmittingRef.current = false;
                    setIsSubmittingChallenge(false);
                    lastSubmissionRef.current = null;
                    setShowChallengeModal(false);
                    setEditingChallenge(null);
                    setChallengeForm({
                      title: "",
                      description: "",
                      type: "daily",
                      points: 0,
                      target: 1,
                      category: "custom",
                      startDate: "",
                      endDate: "",
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmittingChallenge}
                >
                  {isSubmittingChallenge ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      {editingChallenge ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingChallenge ? "Update" : "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pricing Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4 border-2 border-primary">
            <div className="flex items-center justify-between p-4 border-b border-base-300 bg-primary/10">
              <h2 className="text-xl font-bold text-primary">
                {editingPackage ? "Edit Package" : "Create Package"}
              </h2>
              <button
                onClick={() => {
                  setShowPackageModal(false);
                  setEditingPackage(null);
                  setPackageForm({
                    title: "",
                    points: 0,
                    rupees: 0,
                    discount: 0,
                    displayOrder: 0,
                    isActive: true,
                  });
                }}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePackage} className="p-6">
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={packageForm.title}
                  onChange={(e) => setPackageForm({ ...packageForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Points</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={packageForm.points}
                    onChange={(e) => setPackageForm({ ...packageForm, points: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Price (₹)</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={packageForm.rupees}
                    onChange={(e) => setPackageForm({ ...packageForm, rupees: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Discount (%)</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={packageForm.discount}
                    onChange={(e) => setPackageForm({ ...packageForm, discount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Display Order</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={packageForm.displayOrder}
                    onChange={(e) => setPackageForm({ ...packageForm, displayOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>
              {packageForm.discount > 0 && (
                <div className="alert alert-info mb-4">
                  <span>Final Price: ₹{((packageForm.rupees - (packageForm.rupees * packageForm.discount) / 100)).toFixed(2)}</span>
                </div>
              )}
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={packageForm.isActive}
                    onChange={(e) => setPackageForm({ ...packageForm, isActive: e.target.checked })}
                  />
                </label>
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowPackageModal(false);
                    setEditingPackage(null);
                    setPackageForm({
                      title: "",
                      points: 0,
                      rupees: 0,
                      discount: 0,
                      displayOrder: 0,
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPackage ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Events Section */}
      <div className="card bg-base-100 shadow-lg mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">
              <Calendar className="w-5 h-5 mr-2" />
              Calendar Events (Special Dates)
            </h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingEvent(null);
                setCalendarForm({
                  date: "",
                  points: 0,
                  title: "",
                  description: "",
                  isActive: true,
                });
                setShowCalendarModal(true);
              }}
            >
              <Plus size={18} className="mr-2" />
              Add Special Date
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Points</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {calendarEvents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-base-content/60">
                      No calendar events found. Add special dates to reward users!
                    </td>
                  </tr>
                ) : (
                  calendarEvents.map((event) => {
                    const eventDate = new Date(event.date);
                    return (
                      <tr key={event._id}>
                        <td>
                          {eventDate.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="font-semibold">{event.title}</td>
                        <td>
                          <span className="badge badge-primary">{event.points} points</span>
                        </td>
                        <td className="max-w-xs truncate">{event.description || "-"}</td>
                        <td>
                          {event.isActive ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleEditCalendarEvent(event)}
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="btn btn-sm btn-ghost text-error"
                              onClick={() => handleDeleteCalendarEvent(event._id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Calendar Event Modal */}
      {showCalendarModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingEvent ? "Edit Calendar Event" : "Create New Calendar Event"}
            </h3>
            <form onSubmit={handleCreateCalendarEvent}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Date *</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={calendarForm.date}
                  onChange={(e) => setCalendarForm({ ...calendarForm, date: e.target.value })}
                  required
                />
                <label className="label">
                  <span className="label-text-alt">Select any date in any month</span>
                </label>
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={calendarForm.title}
                  onChange={(e) => setCalendarForm({ ...calendarForm, title: e.target.value })}
                  placeholder="e.g., New Year Special, Christmas Bonus"
                  required
                />
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Points *</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={calendarForm.points}
                  onChange={(e) => setCalendarForm({ ...calendarForm, points: parseInt(e.target.value) || 0 })}
                  min="1"
                  required
                />
                <label className="label">
                  <span className="label-text-alt">Points users will receive when they claim this date</span>
                </label>
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={calendarForm.description}
                  onChange={(e) => setCalendarForm({ ...calendarForm, description: e.target.value })}
                  onKeyDown={(e) => {
                    // Allow Enter and Shift+Enter to create new lines in textarea
                    if (e.key === "Enter") {
                      e.stopPropagation(); // Prevent form submission
                    }
                  }}
                  rows={3}
                  placeholder="Optional description for this special date"
                />
              </div>
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={calendarForm.isActive}
                    onChange={(e) => setCalendarForm({ ...calendarForm, isActive: e.target.checked })}
                  />
                </label>
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowCalendarModal(false);
                    setEditingEvent(null);
                    setCalendarForm({
                      date: "",
                      points: 0,
                      title: "",
                      description: "",
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

