# CRITICAL FIX for Translation

## The Problem
Both sender and receiver are seeing the SAME text (original), not translated.

## The Fix
In `backend/src/lib/socket.js` at **line 504**, you need to send DIFFERENT messages to receiver vs sender.

### Current Code (Line 500-509):
```javascript
// Emit to receiver
const receiverSocketId = getReceiverSocketId(receiverId.toString());
if (receiverSocketId) {
  console.log("📤 Emitting new-message to receiver:", receiverId, "socketId:", receiverSocketId);
  io.to(receiverSocketId).emit("new-message", messageWithChatId);  // ❌ WRONG - sends original
  console.log("✅ Message emitted to receiver successfully");
}
```

### REPLACE WITH (add ONE line):
```javascript
// Emit to receiver with TRANSLATED text
const receiverSocketId = getReceiverSocketId(receiverId.toString());
if (receiverSocketId) {
  const messageForReceiver = { ...messageWithChatId, text: translatedText }; // ✅ ADD THIS LINE
  console.log("📤 Emitting TRANSLATED message to receiver:", receiverId, "socketId:", receiverSocketId);
  io.to(receiverSocketId).emit("new-message", messageForReceiver);  // ✅ CHANGE THIS
  console.log("✅ Message emitted to receiver successfully");
}
```

## What This Does
- Creates a COPY of the message
- Overrides the `text` field with `translatedText` (which is "Hello")
- Sends translated version to receiver
- Sender still gets `messageWithChatId` with original text ("नमस्ते")

## After This Fix
- **Sender types:** "नमस्ते" → Sees "नमस्ते" ✅
- **Receiver sees:** "Hello" ✅
- **Database stores:** "नमस्ते" (original) ✅
