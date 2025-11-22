import { useEffect, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Users, Plus, Search, X, Edit, Trash2 } from "lucide-react";
import UserSearch from "./UserSearch";
import toast from "react-hot-toast";

const Groups = () => {
  const { groups, getMyGroups, createGroup, addMemberToGroup, isGroupsLoading, setSelectedGroup, updateGroup, deleteGroup } = useGroupStore();
  const { authUser } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showMemberSearch, setShowMemberSearch] = useState(false);

  useEffect(() => {
    getMyGroups();
  }, [getMyGroups]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    const group = await createGroup({
      name: groupName,
      description: groupDescription,
      members: selectedMembers.map(m => m._id),
    });

    if (group) {
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
      setShowCreateModal(false);
    }
  };

  const handleSelectMember = (user) => {
    // Check if user is already selected
    if (selectedMembers.some(m => m._id === user._id)) {
      toast.error("User already selected");
      return;
    }
    // Don't allow selecting yourself
    if (user._id === authUser._id) {
      toast.error("You are already a member of the group");
      return;
    }
    setSelectedMembers([...selectedMembers, user]);
    // Keep search open for multiple selections
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter(m => m._id !== userId));
  };

  const handleAddMember = (user) => {
    addMemberToGroup(selectedGroupId, user._id);
    setShowAddMemberModal(false);
    setSelectedGroupId(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Groups</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} className="mr-2" />
          Create Group
        </button>
      </div>

      {isGroupsLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-base-content/70">
          No groups yet. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group._id}
              className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedGroup(group);
                useChatStore.getState().setSelectedGroupChat(group._id);
                useChatStore.getState().setSelectedUser(null);
              }}
            >
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-12">
                      <Users size={24} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="card-title text-lg">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm opacity-70 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm">
                    {group.members?.length || 0} members
                  </span>
                  {(group.createdBy === authUser._id || 
                    (typeof group.createdBy === 'object' && group.createdBy._id === authUser._id)) && (
                    <div className="flex gap-1">
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupId(group._id);
                          setShowAddMemberModal(true);
                        }}
                        title="Add Member"
                      >
                        Add Member
                      </button>
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupId(group._id);
                          setGroupName(group.name);
                          setGroupDescription(group.description || "");
                          setShowEditModal(true);
                        }}
                        title="Edit Group"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-xs btn-error"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
                            await deleteGroup(group._id);
                          }
                        }}
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Group Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              {/* Member Selection */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Members</span>
                </label>
                <div className="relative">
                  {!showMemberSearch ? (
                    <button
                      type="button"
                      className="btn btn-outline w-full justify-start"
                      onClick={() => setShowMemberSearch(true)}
                    >
                      <Plus size={18} className="mr-2" />
                      Add Members
                    </button>
                  ) : (
                    <div className="relative">
                      <UserSearch 
                        onSelectUser={handleSelectMember}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost mt-2 w-full"
                        onClick={() => setShowMemberSearch(false)}
                      >
                        Done Adding Members
                      </button>
                    </div>
                  )}
                  
                  {/* Selected Members List */}
                  {selectedMembers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMembers.map((member) => (
                        <div
                          key={member._id}
                          className="badge badge-primary badge-lg gap-2"
                        >
                          <span>{member.fullName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member._id)}
                            className="btn btn-ghost btn-xs btn-circle"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowCreateModal(false);
                    setGroupName("");
                    setGroupDescription("");
                    setSelectedMembers([]);
                    setShowMemberSearch(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Add Member to Group</h3>
            <UserSearch onSelectUser={handleAddMember} onClose={() => setShowAddMemberModal(false)} />
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedGroupId(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit Group</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!groupName.trim()) {
                toast.error("Group name is required");
                return;
              }
              await updateGroup(selectedGroupId, {
                name: groupName,
                description: groupDescription,
              });
              setShowEditModal(false);
              setGroupName("");
              setGroupDescription("");
              setSelectedGroupId(null);
            }}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Group Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setGroupName("");
                    setGroupDescription("");
                    setSelectedGroupId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;

