import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SibApiV3Sdk = require("@getbrevo/brevo");

// Get or create API instance with API key
const getApiInstance = () => {
  if (!process.env.BREVO_API_KEY) {
    return null;
  }
  
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  
  // Set API key - authentications is on apiClient
  if (apiInstance.apiClient) {
    // Ensure authentications object exists
    if (!apiInstance.apiClient.authentications) {
      apiInstance.apiClient.authentications = {};
    }
    // Ensure 'api-key' authentication exists
    if (!apiInstance.apiClient.authentications['api-key']) {
      apiInstance.apiClient.authentications['api-key'] = {
        type: 'apiKey',
        in: 'header',
        name: 'api-key'
      };
    }
    // Set the API key
    apiInstance.apiClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
  }
  
  return apiInstance;
};

/**
 * Send OTP email using Brevo
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} name - Recipient name (optional)
 * @returns {Promise<boolean>}
 */
export const sendOTPEmail = async (email, otp, name = "User") => {
  try {
    const apiInstance = getApiInstance();
    if (!apiInstance) {
      throw new Error("Brevo API key not configured. Please set BREVO_API_KEY in .env");
    }
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = "Your Chatty App OTP Code";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Your OTP Code</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>You requested a One-Time Password (OTP) for your Chatty App account.</p>
              <div class="otp-box">
                <p style="margin: 0 0 10px 0; color: #666;">Your OTP code is:</p>
                <div class="otp-code">${otp}</div>
              </div>
              <p>This code will expire in <strong>10 minutes</strong>.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Chatty App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    sendSmtpEmail.textContent = `
      Hi ${name},
      
      Your OTP code for Chatty App is: ${otp}
      
      This code will expire in 10 minutes.
      
      If you didn't request this code, please ignore this email.
    `;

    sendSmtpEmail.sender = {
      name: "Chatty App",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@chattyapp.com",
    };

    sendSmtpEmail.to = [{ email, name }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("OTP email sent successfully:", result);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

/**
 * Send welcome email using Brevo
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<boolean>}
 */
export const sendWelcomeEmail = async (email, name) => {
  try {
    const apiInstance = getApiInstance();
    if (!apiInstance) {
      console.warn("Brevo API key not configured. Skipping welcome email.");
      return false;
    }
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = "Welcome to Chatty App! 🎉";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Chatty App! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Thank you for joining Chatty App! We're excited to have you on board.</p>
              <p>Start chatting with your friends and explore all the amazing features we have to offer.</p>
              <p>Happy chatting! 💬</p>
            </div>
          </div>
        </body>
      </html>
    `;

    sendSmtpEmail.sender = {
      name: "Chatty App",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@chattyapp.com",
    };

    sendSmtpEmail.to = [{ email, name }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw error for welcome email, it's not critical
    return false;
  }
};

/**
 * Send call request email to offline user using Brevo
 * @param {string} email - Recipient email
 * @param {string} recipientName - Recipient name
 * @param {string} callerName - Caller name
 * @param {string} callType - "video" or "voice"
 * @param {string} message - Call request message
 * @returns {Promise<boolean>}
 */
export const sendCallRequestEmail = async (email, recipientName, callerName, callType, message) => {
  try {
    const apiInstance = getApiInstance();
    if (!apiInstance) {
      throw new Error("Brevo API key not configured. Please set BREVO_API_KEY in .env");
    }
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    const callTypeText = callType === "video" ? "Video" : "Voice";
    const callTypeEmoji = callType === "video" ? "📹" : "📞";

    sendSmtpEmail.subject = `${callTypeText} Call Request from ${callerName}`;
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .message-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${callTypeEmoji} ${callTypeText} Call Request</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p><strong>${callerName}</strong> would like to have a ${callTypeText.toLowerCase()} call with you.</p>
              <div class="message-box">
                <p style="margin: 0; font-style: italic;">"${message}"</p>
              </div>
              <p>Please log in to Chatty App to connect with ${callerName}.</p>
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}" class="button">Open Chatty App</a>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Chatty App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    sendSmtpEmail.textContent = `
      Hi ${recipientName},
      
      ${callerName} would like to have a ${callTypeText.toLowerCase()} call with you.
      
      Message: "${message}"
      
      Please log in to Chatty App to connect with ${callerName}.
    `;

    sendSmtpEmail.sender = {
      name: "Chatty App",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@chattyapp.com",
    };

    sendSmtpEmail.to = [{ email, name: recipientName }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Call request email sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending call request email:", error);
    throw new Error("Failed to send call request email");
  }
};

