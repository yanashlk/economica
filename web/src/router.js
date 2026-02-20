import { createRouter, createWebHashHistory } from "vue-router";
import AdminLogin from "./views/AdminLogin.vue";
import AdminSubmissions from "./views/AdminSubmissions.vue";
import AdminSubmissionDetails from "./views/AdminSubmissionDetails.vue";

function isAuthed() {
    return Boolean(localStorage.getItem("admin_token"));
}

export default createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", redirect: "/brief" },
        { path: "/brief", component: () => import("./views/BriefView.vue") },

        { path: "/admin/login", component: AdminLogin },
        {
            path: "/admin/submissions",
            component: AdminSubmissions,
            beforeEnter: () => (isAuthed() ? true : "/admin/login"),
        },
        {
            path: "/admin/submissions/:id",
            component: AdminSubmissionDetails,
            beforeEnter: () => (isAuthed() ? true : "/admin/login"),
        },
    ],
});