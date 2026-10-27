import { onRequestPost as __api_admin_commit_js_onRequestPost } from "/home/user/Doers/functions/api/admin/commit.js"
import { onRequestGet as __api_admin_file_js_onRequestGet } from "/home/user/Doers/functions/api/admin/file.js"
import { onRequestGet as __api_admin_history_js_onRequestGet } from "/home/user/Doers/functions/api/admin/history.js"
import { onRequestGet as __api_admin_me_js_onRequestGet } from "/home/user/Doers/functions/api/admin/me.js"
import { onRequestPost as __api_contact_js_onRequestPost } from "/home/user/Doers/functions/api/contact.js"
import { onRequest as __api_admin__middleware_js_onRequest } from "/home/user/Doers/functions/api/admin/_middleware.js"

export const routes = [
    {
      routePath: "/api/admin/commit",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_commit_js_onRequestPost],
    },
  {
      routePath: "/api/admin/file",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_file_js_onRequestGet],
    },
  {
      routePath: "/api/admin/history",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_history_js_onRequestGet],
    },
  {
      routePath: "/api/admin/me",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_me_js_onRequestGet],
    },
  {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_contact_js_onRequestPost],
    },
  {
      routePath: "/api/admin",
      mountPath: "/api/admin",
      method: "",
      middlewares: [__api_admin__middleware_js_onRequest],
      modules: [],
    },
  ]