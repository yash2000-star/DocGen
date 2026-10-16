const nodemailer = require("nodemailer");
const { config } = require("./config");

// Configure the email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.email.user, // Your Gmail address
    pass: config.email.pass  // Your Gmail App Password (NOT your regular password)
  }
});

async function sendSuccessEmail(toEmail, tenant, project) {
  // The link to the generated docs
  const docLink = `${config.frontendUrl}/docs/${tenant}/${project}`;
  
  const mailOptions = {
    from: '"DocGen AI" <no-reply@docgen.com>',
    to: toEmail,
    subject: `🎉 Your documentation for ${project} is ready!`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #111827;">Your Docs are Live! 🚀</h2>
        <p style="color: #4b5563; font-size: 16px;">Great news! We've finished analyzing the <strong>${project}</strong> repository and generating your AI documentation.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${docLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">View Your Documentation</a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #3b82f6; font-size: 14px;"><a href="${docLink}">${docLink}</a></p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] 📧 Success email sent to ${toEmail}`);
  } catch (error) {
    console.error("[Email] ❌ Failed to send email:", error);
  }
}

module.exports = { sendSuccessEmail };