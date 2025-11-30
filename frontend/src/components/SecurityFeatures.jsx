import { useEffect } from "react";

const SecurityFeatures = () => {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Block screenshot attempts (Print Screen, Snipping Tool)
    const handleKeyDown = (e) => {
      // Block Print Screen
      if (e.key === "PrintScreen" || (e.ctrlKey && e.shiftKey && e.key === "S")) {
        e.preventDefault();
        return false;
      }
    };

    // Detect DevTools
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        // Don't clear console - just show warning once
        // console.clear() causes flickering
        // console.log("%cStop!", "color: red; font-size: 50px; font-weight: bold;");
        // console.log("%cThis is a browser feature intended for developers.", "font-size: 16px;");
      }
    };

    // Add watermark
    const addWatermark = () => {
      // Remove existing watermark if it exists
      const existingWatermark = document.getElementById("security-watermark");
      if (existingWatermark) {
        existingWatermark.remove();
      }

      const watermark = document.createElement("div");
      watermark.id = "security-watermark";
      watermark.style.cssText = `
        position: fixed !important;
        bottom: 10px !important;
        right: 10px !important;
        opacity: 0.3;
        font-size: 12px;
        color: #999;
        pointer-events: none;
        z-index: 99999 !important;
        transform: translateZ(0);
        will-change: transform;
      `;
      watermark.textContent = `Chatty App - ${new Date().toLocaleDateString()}`;
      
      // Append to body to ensure it's not affected by page containers
      document.body.appendChild(watermark);
      
      // Ensure body and html don't have overflow that could affect fixed positioning
      const body = document.body;
      const html = document.documentElement;
      if (!body.style.position) {
        body.style.position = 'relative';
      }
    };

    // Disable photo capture on mobile
    const handleTouchStart = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", detectDevTools);
    document.addEventListener("touchstart", handleTouchStart, { passive: false });

    // Check for DevTools periodically
    const devToolsInterval = setInterval(detectDevTools, 1000);

    addWatermark();

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", detectDevTools);
      document.removeEventListener("touchstart", handleTouchStart);
      clearInterval(devToolsInterval);
      const watermark = document.getElementById("security-watermark");
      if (watermark) watermark.remove();
    };
  }, []);

  return null;
};

export default SecurityFeatures;

