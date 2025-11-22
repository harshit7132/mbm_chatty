import { useEffect, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import { Users, X, AlertTriangle } from "lucide-react";

const GroupMembers = ({ groupId, onClose }) => {
  const { selectedGroup } = useGroupStore();
  const { authUser } = useAuthStore();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (groupId) {
      fetchMembers();
    }
  }, [groupId]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/group/${groupId}/members`);
      setMembers(res.data.members || []);
      setIsOwner(res.data.isOwner || false);
    } catch (error) {
      console.error("Failed to fetch group members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Users size={20} />
            Group Members ({members.length})
          </h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {isOwner && (
          <div className="alert alert-info mb-4">
            <Users size={20} />
            <span>As the group owner, you can see all members.</span>
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {members.map((member) => (
            <div
              key={member._id}
              className="flex items-center gap-3 p-3 bg-base-200 rounded-lg"
            >
              <div className="avatar">
                <div className="w-10 rounded-full">
                  {member.isSuspicious ? (
                    <div className="bg-error/20 flex items-center justify-center">
                      <AlertTriangle size={20} className="text-error" />
                    </div>
                  ) : (
                    <img
                      src={member.profilePic || member.avatar || "/avatar.png"}
                      alt={member.fullName}
                    />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {member.isSuspicious ? (
                    <span className="text-error">Suspicious</span>
                  ) : (
                    member.fullName
                  )}
                </div>
                {!member.isSuspicious && member.email && (
                  <div className="text-sm text-base-content/70">
                    {member.email}
                  </div>
                )}
              </div>
              {member.isOwner && (
                <span className="badge badge-primary badge-sm">Owner</span>
              )}
              {member.isSuspicious && (
                <span className="badge badge-error badge-sm">
                  <AlertTriangle size={12} className="mr-1" />
                  Not a friend
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupMembers;

