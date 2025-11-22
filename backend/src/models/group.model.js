import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    onlyAdminsCanSendMessages: {
      type: Boolean,
      default: false,
    },
    groupPic: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Add creator as admin and member
groupSchema.pre("save", function (next) {
  if (this.isNew) {
    if (!this.admins.includes(this.createdBy)) {
      this.admins.push(this.createdBy);
    }
    if (!this.members.includes(this.createdBy)) {
      this.members.push(this.createdBy);
    }
  }
  next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group;

