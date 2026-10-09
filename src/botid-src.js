import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/contact", method: "POST" },
    { path: "/api/rdv", method: "POST" },
    { path: "/api/_db", method: "POST" },
    { path: "/api/admin", method: "POST" },
    { path: "/api/collect", method: "POST" },
    { path: "/api/info", method: "POST" },
    { path: "/api/purge", method: "POST" },
    { path: "/api/tickets", method: "POST" },
    { path: "/api/tracker", method: "POST" },
  ],
});