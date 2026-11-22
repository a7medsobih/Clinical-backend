// Saves one notification for a user. The website checks for new ones every 30 seconds.
// link = the page that opens when the user clicks the notification (optional).
import prisma from "../prisma.js";

export async function notify(userId, title, message, link = null) {
  await prisma.notification.create({ data: { userId, title, message, link } });
}
