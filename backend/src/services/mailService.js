import nodemailer from "nodemailer";

/**
 * Send password reset email to the user.
 * Falls back to console logging if SMTP credentials are not configured.
 */
export const sendResetPasswordEmail = async ({ to, username, resetUrl }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  const hasSmtpConfig = SMTP_HOST && SMTP_USER && SMTP_PASS;

  if (hasSmtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10) || 587,
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });

      const mailOptions = {
        from: EMAIL_FROM || `"Connect Meet" <no-reply@connectmeet.com>`,
        to: to,
        subject: "Connect Meet - Password Reset Request",
        text: `Hello ${username || "User"},\n\nYou recently requested to reset your password for your Connect Meet account.\n\nClick the link below or paste it into your browser to reset your password:\n${resetUrl}\n\nThis link is valid for 15 minutes. If you did not request this, please ignore this email.\n\nBest regards,\nThe Connect Meet Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0B0F19; color: #F8FAFC; border-radius: 12px; overflow: hidden; border: 1px solid #1E293B;">
            <div style="background: #111827; padding: 24px; text-align: center; border-bottom: 1px solid #1E293B;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #3B82F6; letter-spacing: -0.02em;">Connect Meet</h1>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="margin-top: 0; font-size: 18px; color: #F8FAFC;">Password Reset Request</h2>
              <p style="color: #94A3B8; font-size: 15px; line-height: 1.6;">
                Hello <strong>${username || "there"}</strong>,
              </p>
              <p style="color: #94A3B8; font-size: 15px; line-height: 1.6;">
                We received a request to reset the password for your Connect Meet account. Click the button below to set a new password:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #2563EB; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                  Reset My Password
                </a>
              </div>
              <p style="color: #94A3B8; font-size: 13px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br />
                <a href="${resetUrl}" style="color: #3B82F6; word-break: break-all;">${resetUrl}</a>
              </p>
              <p style="color: #64748B; font-size: 12px; margin-top: 24px; border-top: 1px solid #1E293B; paddingTop: 16px;">
                This reset link will expire in 15 minutes. If you did not initiate this request, you can safely ignore this email.
              </p>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] Password reset sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[EMAIL ERROR] Failed to send email via SMTP:", err.message);
      // Fallback log to console so testing is never blocked
      logResetToConsole(to, username, resetUrl);
      return { success: true, fallback: true };
    }
  } else {
    // Development / production without SMTP credentials: Log cleanly to server console
    logResetToConsole(to, username, resetUrl);
    return { success: true, simulated: true };
  }
};

const logResetToConsole = (to, username, resetUrl) => {
  console.log("\n==================== [PASSWORD RESET DISPATCH] ====================");
  console.log(`Recipient: ${to || "Account User"}`);
  console.log(`Username:  ${username || "N/A"}`);
  console.log(`Reset URL: ${resetUrl}`);
  console.log("Token Expiration: 15 minutes");
  console.log("Tip: Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env for live email dispatch.");
  console.log("===================================================================\n");
};
