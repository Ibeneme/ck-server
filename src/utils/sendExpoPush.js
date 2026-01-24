const { Expo } = require("expo-server-sdk");

const expo = new Expo();

const sendExpoPush = async ({ expoPushToken, title, body, data = {} }) => {
  try {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.log("❌ Invalid Expo push token:", expoPushToken);
      return;
    }

    const message = {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data,
    };

    await expo.sendPushNotificationsAsync([message]);

    console.log("✅ Expo push notification sent");
  } catch (error) {
    console.error("🔥 Expo Push Error:", error.message);
  }
};

module.exports = sendExpoPush;
