const sendEmailTransporter = require("./sendEmailTransporter");
const sendExpoPush = require("./sendExpoPush");
const User = require("../models/User");

/**
 * @param {Object} params
 * @param {String} params.userId
 * @param {String} params.title
 * @param {String} params.description
 * @param {String} [params.orderId]
 * @param {String} params.type - Notification type (ORDER_PLACED, ORDER_PAID, etc)
 */
const notifyUser = async ({ userId, title, description, orderId, type }) => {
  console.log(`🚀 [notifyUser] Triggered for User: ${userId} | Type: ${type}`);

  try {
    const user = await User.findById(userId);

    if (!user) {
      console.log(
        `❌ [notifyUser] Error: User ${userId} not found in database`
      );
      return;
    }

    /* ==========================
       📧 EMAIL NOTIFICATION
    ========================== */
    if (user.email) {
      console.log(`📩 [notifyUser] Attempting Email to: ${user.email}`);

      await sendEmailTransporter({
        to: user.email,
        subject: `CloneKraft: ${title}`,
        html: `
          <div style="background-color: #f9f9f9; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eeeeee; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              
              <div style="background-color: #000000; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">CLONEKRAFT</h1>
              </div>

              <div style="padding: 40px 30px;">
                <h2 style="color: #111; font-size: 20px;">${title}</h2>
                <p style="font-size: 16px;">Hi ${user.firstName || "there"},</p>
                <p style="font-size: 16px;">${description}</p>

                ${
                  orderId
                    ? `
                  <div style="margin: 30px 0; padding: 20px; background-color: #f3f3f3; border-radius: 8px; border-left: 4px solid #000;">
                    <p style="margin: 0; font-size: 14px;">Order Reference</p>
                    <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">#${orderId}</p>
                  </div>
                `
                    : ""
                }

                <p style="font-size: 14px; color: #888;">
                  Notification Type: <strong>${type}</strong>
                </p>
              </div>

              <div style="padding: 20px; background-color: #fafafa; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #aaa;">
                  &copy; ${new Date().getFullYear()} CloneKraft. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
      });
      console.log(`📧 [notifyUser] Email sent successfully to ${user.email}`);
    } else {
      console.log(`⚠️ [notifyUser] Skipping Email: User has no email address`);
    }

    /* ==========================
       🔔 EXPO PUSH NOTIFICATION
    ========================== */
    if (user.expoPushToken) {
      console.log(
        `📲 [notifyUser] Attempting Push to Token: ${user.expoPushToken.slice(
          0,
          15
        )}...`
      );

      await sendExpoPush({
        expoPushToken: user.expoPushToken,
        title,
        body: description,
        data: {
          type,
          orderId,
          userId: user._id.toString(),
        },
      });
      console.log(`🔔 [notifyUser] Push notification dispatched successfully`);
    } else {
      console.log(`⚠️ [notifyUser] Skipping Push: User has no expoPushToken`);
    }

    console.log(
      `✅ [notifyUser] Final Status: Type: ${type} | Email: ${!!user.email} | Push: ${!!user.expoPushToken}`
    );
  } catch (error) {
    console.error("🔥 [notifyUser] Critical Error:", error.message);
  }
};

module.exports = notifyUser;
