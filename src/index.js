// Local Node.js entry point. Vercel imports src/app.js instead.
import app from "./app.js";
import { startReminderJob } from "./controllers/notifications.controller.js";

// Start the server (tests import the app without starting it)
if (process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log(`Clinical API running on http://localhost:${port}`));
  startReminderJob();
}

export default app;
