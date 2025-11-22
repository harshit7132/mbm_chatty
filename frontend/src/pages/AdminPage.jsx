import { useEffect, useState } from "react";
import { useAdminStore } from "../store/useAdminStore";
import { useAuthStore } from "../store/useAuthStore";
import { Users, MessageSquare, Trash2, Shield, Target, Plus, Edit, X } from "lucide-react";
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
  });

  useEffect(() => {
    if (authUser?.isAdmin) {
      getDashboardStats();
      getAllUsers();
      fetchChallenges();
    }
  }, [authUser, getDashboardStats, getAllUsers]);

  const fetchChallenges = async () => {
    try {
      const res = await axiosInstance.get("/challenge/all");
      setChallenges(res.data);
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      if (editingChallenge) {
        await axiosInstance.put(`/challenge/${editingChallenge._id}`, challengeForm);
        toast.success("Challenge updated successfully");
      } else {
        await axiosInstance.post("/challenge/create", challengeForm);
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
      });
      fetchChallenges();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save challenge");
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
                {challenges.map((challenge) => (
                  <tr key={challenge._id}>
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
                ))}
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
            <form onSubmit={handleCreateChallenge}>
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
                    onChange={(e) => setChallengeForm({ ...challengeForm, category: e.target.value })}
                  >
                    <option value="custom">Custom</option>
                    <option value="chat">Chat</option>
                    <option value="messages">Messages</option>
                    <option value="time">Time</option>
                    <option value="streak">Streak</option>
                  </select>
                </div>
              </div>
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
                    <span className="label-text">Target *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={challengeForm.target}
                    onChange={(e) => setChallengeForm({ ...challengeForm, target: Number(e.target.value) })}
                    min="1"
                    required
                  />
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
                <button type="submit" className="btn btn-primary">
                  {editingChallenge ? "Update" : "Create"}
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

