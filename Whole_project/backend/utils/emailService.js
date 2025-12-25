// WHOLE_PROJECT/utils/emailService.js
import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports (like 587 with STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // For services like Gmail, you might need to allow "less secure app access"
    // or use an "App Password" if 2FA is enabled.
    // tls: {
    //     rejectUnauthorized: false // Often needed for local development or self-signed certs
    // }
});

export const sendOTPEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject: 'Your One-Time Password (OTP)',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Your OTP Code</h2>
                <p>Please use the following OTP to proceed. This OTP is valid for 5 minutes.</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #333;">${otp}</p>
                <p>If you did not request this OTP, please ignore this email.</p>
                <p>Thanks,<br/>Your App Team</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('OTP Email sent: ' + info.response);
        return true;
    } catch (error)
    {
        console.error('Error sending OTP email:', error);
        return false;
    }
};