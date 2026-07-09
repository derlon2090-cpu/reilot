const { runCron } = require("../_lib/cron");

module.exports = function handler(req, res) {
  runCron(req, res, "cleanup", {
    action: "Clear stale QR cache, expired sessions, and old temporary queue records.",
    destructiveDeletes: false
  });
};
