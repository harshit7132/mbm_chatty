import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import PricingPackage from "../models/pricingPackage.model.js";
import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import crypto from "crypto";
import Razorpay from "razorpay";

const router = express.Router();

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Get all active pricing packages
router.get("/packages", protectRoute, async (req, res) => {
  try {
    const packages = await PricingPackage.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.status(200).json({ packages });
  } catch (error) {
    console.error("Error fetching pricing packages:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Create Razorpay order
router.post("/create-order", protectRoute, async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user._id;

    if (!packageId) {
      return res.status(400).json({ message: "Package ID is required" });
    }

    // Check if Razorpay credentials are configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials not configured in .env file");
      return res.status(500).json({ 
        message: "Payment gateway not configured. Please contact administrator." 
      });
    }

    // Find the package
    const packageData = await PricingPackage.findById(packageId);
    if (!packageData || !packageData.isActive) {
      return res.status(404).json({ message: "Package not found or inactive" });
    }

    // Calculate final amount
    const finalAmount = packageData.discount > 0
      ? packageData.rupees - (packageData.rupees * packageData.discount) / 100
      : packageData.rupees;

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Generate a shorter receipt (max 40 characters for Razorpay)
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const userIdShort = userId.toString().slice(-6); // Last 6 characters of user ID
    const receipt = `CHT${userIdShort}${timestamp}`; // Format: CHT + 6 chars + 8 digits = 17 chars
    
    const order = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100), // Convert to paise
      currency: "INR",
      receipt: receipt,
      notes: {
        userId: userId.toString(),
        packageId: packageId.toString(),
        points: packageData.points.toString(),
      },
    });

    // Create payment record
    const payment = await Payment.create({
      userId,
      packageId,
      points: packageData.points,
      amount: packageData.rupees,
      discount: packageData.discount,
      finalAmount: finalAmount,
      razorpayOrderId: order.id,
      status: "pending",
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Verify and complete payment
router.post("/verify-payment", protectRoute, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user._id;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    // Find payment record
    const payment = await Payment.findOne({
      razorpayOrderId,
      userId,
      status: "pending",
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Verify signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update payment record
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = "completed";
    await payment.save();

    // Add points to user
    const user = await User.findById(userId);
    const currentPoints = user.points || user.totalPoints || 0;
    const newPoints = currentPoints + payment.points;

    // Update user points
    user.points = newPoints;
    user.totalPoints = newPoints;

    // Add to points history
    user.pointsHistory.push({
      type: "earned",
      amount: payment.points,
      description: `Purchased ${payment.points} chatty points`,
      timestamp: new Date(),
    });

    await user.save();

    res.status(200).json({
      message: "Payment verified successfully",
      pointsAdded: payment.points,
      totalPoints: newPoints,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Get user's payment history
router.get("/my-payments", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await Payment.find({ userId })
      .populate("packageId", "title points rupees discount")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ payments });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Admin: Create pricing package
router.post("/admin/packages", protectRoute, isAdmin, async (req, res) => {
  try {
    const { title, points, rupees, discount, displayOrder } = req.body;

    if (!title || !points || !rupees) {
      return res.status(400).json({ message: "Title, points, and rupees are required" });
    }

    const packageData = await PricingPackage.create({
      title,
      points,
      rupees,
      discount: discount || 0,
      displayOrder: displayOrder || 0,
      createdBy: req.user._id,
    });

    res.status(201).json({ package: packageData });
  } catch (error) {
    console.error("Error creating pricing package:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Admin: Update pricing package
router.put("/admin/packages/:id", protectRoute, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, rupees, discount, isActive, displayOrder } = req.body;

    const packageData = await PricingPackage.findByIdAndUpdate(
      id,
      {
        ...(title && { title }),
        ...(points !== undefined && { points }),
        ...(rupees !== undefined && { rupees }),
        ...(discount !== undefined && { discount }),
        ...(isActive !== undefined && { isActive }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
      { new: true, runValidators: true }
    );

    if (!packageData) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json({ package: packageData });
  } catch (error) {
    console.error("Error updating pricing package:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Admin: Delete pricing package
router.delete("/admin/packages/:id", protectRoute, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const packageData = await PricingPackage.findByIdAndDelete(id);

    if (!packageData) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json({ message: "Package deleted successfully" });
  } catch (error) {
    console.error("Error deleting pricing package:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Admin: Get all packages (including inactive)
router.get("/admin/packages", protectRoute, isAdmin, async (req, res) => {
  try {
    const packages = await PricingPackage.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.status(200).json({ packages });
  } catch (error) {
    console.error("Error fetching all packages:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

export default router;

