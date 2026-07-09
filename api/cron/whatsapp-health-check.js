const { runCron } = require("../_lib/cron");

module.exports = function handler(req, res) {
  runCron(req, res, "whatsapp-health-check", {
    action: "Check connected WhatsApp channels in batches and update channel health.",
    batchSize: 50
  });
};
