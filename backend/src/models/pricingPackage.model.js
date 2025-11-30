import mongoose from "mongoose";

const pricingPackageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
    },
    rupees: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100, // Percentage discount
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Calculate final price after discount
pricingPackageSchema.virtual("finalPrice").get(function () {
  if (this.discount > 0) {
    return this.rupees - (this.rupees * this.discount) / 100;
  }
  return this.rupees;
});

pricingPackageSchema.set("toJSON", { virtuals: true });
pricingPackageSchema.set("toObject", { virtuals: true });

const PricingPackage = mongoose.model("PricingPackage", pricingPackageSchema);

export default PricingPackage;

