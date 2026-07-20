console.warn("admin:bootstrap is deprecated; promoting an existing user without changing credentials.");
await import("./promote-admin.mjs");
