import { useState, useEffect } from "react";
import { X, ShoppingCart, Loader } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";

const PurchasePointsModal = ({ onClose, packages: initialPackages }) => {
  const [packages, setPackages] = useState(initialPackages || []);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const { refreshAuthUser } = useAuthStore();

  useEffect(() => {
    if (!packages || packages.length === 0) {
      fetchPackages();
    }
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await axiosInstance.get("/payment/packages");
      setPackages(res.data.packages || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
      toast.error("Failed to load packages");
    }
  };

  const handlePurchase = async (pkg) => {
    if (loading) return;
    
    setSelectedPackage(pkg._id);
    setLoading(true);

    try {
      // Create Razorpay order
      const orderRes = await axiosInstance.post("/payment/create-order", {
        packageId: pkg._id,
      });

      const { orderId, amount, keyId } = orderRes.data;

      // Load Razorpay script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        const options = {
          key: keyId,
          amount: amount,
          currency: "INR",
          name: "Chatty App",
          description: `Purchase ${pkg.points} Chatty Points`,
          order_id: orderId,
          handler: async function (response) {
            try {
              // Verify payment
              const verifyRes = await axiosInstance.post("/payment/verify-payment", {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              toast.success(`Successfully purchased ${pkg.points} Chatty Points!`);
              await refreshAuthUser();
              onClose();
            } catch (error) {
              console.error("Payment verification error:", error);
              toast.error(error.response?.data?.message || "Payment verification failed");
            } finally {
              setLoading(false);
              setSelectedPackage(null);
            }
          },
          prefill: {
            name: "",
            email: "",
          },
          theme: {
            color: "#3b82f6",
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              setSelectedPackage(null);
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };
      script.onerror = () => {
        toast.error("Failed to load Razorpay");
        setLoading(false);
        setSelectedPackage(null);
      };
      document.body.appendChild(script);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error(error.response?.data?.message || "Failed to create order");
      setLoading(false);
      setSelectedPackage(null);
    }
  };

  const calculateFinalPrice = (pkg) => {
    if (pkg.discount > 0) {
      return pkg.rupees - (pkg.rupees * pkg.discount) / 100;
    }
    return pkg.rupees;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl mx-4 border-2 border-primary max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-primary/10 sticky top-0 bg-base-100 z-10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-primary">Purchase Chatty Points</h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/70">No packages available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => {
                const finalPrice = calculateFinalPrice(pkg);
                const isSelected = selectedPackage === pkg._id;
                
                return (
                  <div
                    key={pkg._id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-base-300 hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-bold">{pkg.title}</h3>
                        {pkg.discount > 0 && (
                          <span className="badge badge-success badge-sm mt-1">
                            {pkg.discount}% OFF
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        {pkg.points} Points
                      </div>
                      <div className="flex items-baseline gap-2">
                        {pkg.discount > 0 && (
                          <span className="text-base-content/50 line-through">
                            ₹{pkg.rupees}
                          </span>
                        )}
                        <span className="text-2xl font-bold">₹{finalPrice.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handlePurchase(pkg)}
                        className="btn btn-primary w-full"
                        disabled={loading}
                      >
                        {isSelected && loading ? (
                          <>
                            <Loader className="animate-spin mr-2" size={18} />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={18} className="mr-2" />
                            Purchase
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchasePointsModal;

