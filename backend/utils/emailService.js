import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import "dotenv/config";

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── OTP Email ───
export const sendOTPEmail = async (toEmail, otp) => {
  const command = new SendEmailCommand({
    Source: process.env.EMAIL_FROM, // must be a verified SES identity
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: "Your One-Time Password (OTP)" },
      Body: {
        Html: {
          Data: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Your OTP Code</h2>
              <p>Use the following OTP to proceed. It is valid for <strong>5 minutes</strong>.</p>
              <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#333;">
                ${otp}
              </p>
              <p>If you did not request this, please ignore this email.</p>
              <p>Thanks,<br/>Your App Team</p>
            </div>`,
        },
      },
    },
  });

  try {
    const result = await sesClient.send(command);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending OTP email via SES:", error);
    throw error;
  }
};

// Welcome Email
export const sendWelcomeEmail = async ({ toEmail, name, password }) => {
  const command = new SendEmailCommand({
    Source: process.env.EMAIL_FROM,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: "Welcome — Your Account Has Been Created" },
      Body: {
        Html: {
          Data: `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
              border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#4F46E5;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">Welcome to the Platform</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;color:#374151;">
      <p style="margin-top:0;">Hi <strong>${name}</strong>,</p>
      <p>Your profile has been created. Here are your login credentials:</p>

      <!-- Credentials box -->
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;
                  border-radius:6px;padding:16px 20px;margin:20px 0;">

        <!-- Email row -->
        <div style="margin-bottom:12px;">
          <div style="font-size:12px;color:#6B7280;margin-bottom:2px;">Email</div>
          <div style="font-size:14px;font-weight:600;color:#111827;word-break:break-all;">${toEmail}</div>
        </div>

        <!-- Password row -->
        <div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:2px;">Password</div>
          <div style="font-size:14px;font-weight:600;color:#111827;letter-spacing:1px;">${password}</div>
        </div>

      </div>

      <p style="margin-bottom:0;margin-top:24px;font-size:13px;color:#6B7280;">
        If you did not expect this email, contact your administrator immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F3F4F6;padding:16px 32px;
                font-size:12px;color:#9CA3AF;text-align:center;">
      © ${new Date().getFullYear()} Your App. All rights reserved.
    </div>

  </div>`,
        },
      },
    },
  });

  try {
    const result = await sesClient.send(command);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending welcome email via SES:", error);
    throw error;
  }
};
