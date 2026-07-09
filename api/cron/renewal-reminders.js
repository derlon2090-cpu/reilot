const { runCron } = require("../_lib/cron");

module.exports = function handler(req, res) {
  runCron(req, res, "renewal-reminders", {
    action: "Queue renewal reminder messages for active automation rules.",
    windows: [7, 3, 1, 0, -1, -3],
    sendsDirectly: false
  });
};
