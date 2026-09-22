/*
 * BladderSense admin dashboard.
 *
 * Served by the backend at /admin, so API calls are same-origin and the
 * httpOnly bladdersense_session cookie is sent automatically. Sign-in
 * reuses the normal email + 6-digit code flow (/api/auth/*).
 *
 * All user-supplied text is written with textContent, never innerHTML.
 */
(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const state = {
        page: 1,
        limit: 20,
        search: "",
        status: "",
        totalPages: 1,
        selectedUserId: null
    };


    // ============================================================
    // HELPERS
    // ============================================================

    const api = async (path, options = {}) => {
        const response = await fetch(`/api${path}`, {
            credentials: "same-origin",
            headers: options.body
                ? { "Content-Type": "application/json" }
                : undefined,
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            // Non-JSON response; leave data empty.
        }

        if (!response.ok) {
            const error = new Error(
                data.error || `Request failed (${response.status})`
            );
            error.status = response.status;
            throw error;
        }

        return data;
    };

    // Build an element: el("td", { className: "num" }, "12", child, ...)
    const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);

        Object.assign(node, props);

        for (const child of children) {
            if (child === null || child === undefined || child === false) {
                continue;
            }

            node.append(
                child instanceof Node ? child : document.createTextNode(String(child))
            );
        }

        return node;
    };

    const formatDate = (value) => {
        if (!value) {
            return "—";
        }

        // Plain YYYY-MM-DD dates are calendar days; don't shift by timezone.
        const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T00:00:00`)
            : new Date(value);

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    const formatDateTime = (value) => {
        if (!value) {
            return "Never";
        }

        return new Date(value).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const displayName = (user) => {
        const full = `${user.firstName} ${user.lastName}`.trim();

        return user.preferredName && user.preferredName !== user.firstName
            ? `${full} (${user.preferredName})`
            : full;
    };

    const formatNumber = (value) =>
        value === null || value === undefined ? "—" : value.toLocaleString();

    let toastTimer = null;

    const toast = (message, isError = false) => {
        const node = $("toast");

        node.textContent = message;
        node.className = isError ? "toast toast-error" : "toast";
        node.hidden = false;

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            node.hidden = true;
        }, 3500);
    };

    const showView = (name) => {
        $("login-view").hidden = name !== "login";
        $("denied-view").hidden = name !== "denied";
        $("app-view").hidden = name !== "app";
    };


    // ============================================================
    // SIGN IN
    // ============================================================

    let loginEmail = "";

    const showLoginError = (message) => {
        const node = $("login-error");

        node.textContent = message || "";
        node.hidden = !message;
    };

    const resetLogin = () => {
        $("email-form").hidden = false;
        $("code-form").hidden = true;
        $("login-code").value = "";
        showLoginError("");
    };

    $("email-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = event.submitter;
        button.disabled = true;
        showLoginError("");

        loginEmail = $("login-email").value.trim().toLowerCase();

        try {
            await api("/auth/request-login", {
                method: "POST",
                body: { email: loginEmail }
            });

            $("code-email").textContent = loginEmail;
            $("email-form").hidden = true;
            $("code-form").hidden = false;
            $("login-code").focus();

        } catch (error) {
            showLoginError(error.message);

        } finally {
            button.disabled = false;
        }
    });

    $("code-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = event.submitter;
        button.disabled = true;
        showLoginError("");

        try {
            await api("/auth/verify-login", {
                method: "POST",
                body: {
                    email: loginEmail,
                    token: $("login-code").value.trim()
                }
            });

            resetLogin();
            await boot();

        } catch (error) {
            showLoginError(error.message);

        } finally {
            button.disabled = false;
        }
    });

    $("code-back").addEventListener("click", resetLogin);

    const logout = async () => {
        try {
            await api("/auth/logout", { method: "POST" });
        } catch (error) {
            // Signing out locally is enough even if the call fails.
        }

        resetLogin();
        showView("login");
    };

    $("logout").addEventListener("click", logout);
    $("denied-logout").addEventListener("click", logout);


    // ============================================================
    // OVERVIEW
    // ============================================================

    const renderStats = (stats) => {
        const pct = (part, whole) =>
            whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

        const tiles = [
            ["Total users", stats.totalUsers,
                `${formatNumber(stats.newUsers7d)} new this week`],
            ["Verified", stats.verifiedUsers,
                `${pct(stats.verifiedUsers, stats.totalUsers)} of users`],
            ["Active (7 days)", stats.activeUsers7d,
                `${formatNumber(stats.activeUsers30d)} in 30 days`],
            ["Tracking entries", stats.totalEntries,
                `${formatNumber(stats.entries7d)} this week`],
            ["Reminders on", stats.remindersEnabled,
                "users who opted in"],
            ["Signed-in sessions", stats.activeSessions,
                `${formatNumber(stats.adminUsers)} admin account(s)`]
        ];

        $("stats").replaceChildren(
            ...tiles.map(([label, value, sub]) =>
                el("div", { className: "stat" },
                    el("div", { className: "stat-label" }, label),
                    el("div", { className: "stat-value" }, formatNumber(value)),
                    el("div", { className: "stat-sub" }, sub)
                )
            )
        );
    };

    const renderActivity = (days) => {
        const max = Math.max(1, ...days.map((d) => Math.max(d.entries, d.signups)));

        $("activity").replaceChildren(
            ...days.map((day) => {
                const date = new Date(`${String(day.date).slice(0, 10)}T00:00:00`);
                const label = date.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short"
                });

                const entriesBar = el("div", { className: "bar bar-entries" });
                entriesBar.style.height = `${(day.entries / max) * 100}%`;

                const signupsBar = el("div", { className: "bar bar-signups" });
                signupsBar.style.height = `${(day.signups / max) * 100}%`;

                return el("div", {
                    className: "day",
                    title: `${label}: ${day.entries} entries, ${day.signups} sign-ups`
                },
                    el("div", { className: "bars" }, entriesBar, signupsBar),
                    el("div", { className: "day-label" }, label)
                );
            })
        );
    };

    const loadOverview = async () => {
        const data = await api("/admin/stats");

        renderStats(data.stats);
        renderActivity(data.dailyActivity);
    };


    // ============================================================
    // USERS TABLE
    // ============================================================

    const statusBadges = (user) => [
        user.emailVerified
            ? el("span", { className: "badge badge-ok" }, "Verified")
            : el("span", { className: "badge badge-warn" }, "Unverified"),
        user.isAdmin
            ? el("span", { className: "badge badge-admin" }, "Admin")
            : null
    ];

    const loadUsers = async () => {
        const params = new URLSearchParams({
            page: state.page,
            limit: state.limit
        });

        if (state.search) {
            params.set("search", state.search);
        }

        if (state.status) {
            params.set("status", state.status);
        }

        const data = await api(`/admin/users?${params}`);
        const { users, pagination } = data;

        state.totalPages = pagination.totalPages;

        const rows = users.length === 0
            ? [el("tr", { className: "empty-row" },
                el("td", { colSpan: 6 }, "No users match these filters."))]
            : users.map((user) => {
                const row = el("tr", { tabIndex: 0 },
                    el("td", {}, displayName(user)),
                    el("td", {}, user.email),
                    el("td", {}, ...statusBadges(user)),
                    el("td", { className: "num" }, formatNumber(user.entryCount)),
                    el("td", {}, formatDate(user.lastEntryDate)),
                    el("td", {}, formatDate(user.createdAt))
                );

                row.addEventListener("click", () => openUser(user.id));
                row.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        openUser(user.id);
                    }
                });

                return row;
            });

        $("users-body").replaceChildren(...rows);

        const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
        const last = Math.min(pagination.page * pagination.limit, pagination.total);

        $("pager-info").textContent =
            `${first}–${last} of ${pagination.total.toLocaleString()} users`;
        $("prev-page").disabled = pagination.page <= 1;
        $("next-page").disabled = pagination.page >= pagination.totalPages;
    };

    let searchTimer = null;

    $("user-search").addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = $("user-search").value.trim();
            state.page = 1;
            loadUsers().catch(handleError);
        }, 300);
    });

    $("user-status").addEventListener("change", () => {
        state.status = $("user-status").value;
        state.page = 1;
        loadUsers().catch(handleError);
    });

    $("user-filters").addEventListener("submit", (event) => event.preventDefault());

    $("prev-page").addEventListener("click", () => {
        if (state.page > 1) {
            state.page -= 1;
            loadUsers().catch(handleError);
        }
    });

    $("next-page").addEventListener("click", () => {
        if (state.page < state.totalPages) {
            state.page += 1;
            loadUsers().catch(handleError);
        }
    });


    // ============================================================
    // USER DRAWER
    // ============================================================

    const closeDrawer = () => {
        $("drawer").hidden = true;
        $("drawer-backdrop").hidden = true;
        state.selectedUserId = null;
    };

    $("drawer-close").addEventListener("click", closeDrawer);
    $("drawer-backdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !$("drawer").hidden) {
            closeDrawer();
        }
    });

    const trendText = (trend) => {
        switch (trend && trend.direction) {
            case "improving": return "Improving";
            case "worsening": return "Worsening";
            case "stable": return "Stable";
            default: return "Not enough data";
        }
    };

    const kv = (pairs) =>
        el("dl", { className: "kv" },
            ...pairs.flatMap(([key, value]) => [
                el("dt", {}, key),
                el("dd", {}, value)
            ])
        );

    const actionButton = (label, className, handler) => {
        const button = el("button", { type: "button", className: `btn btn-small ${className}` }, label);

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await handler();
            } catch (error) {
                handleError(error);
            } finally {
                button.disabled = false;
            }
        });

        return button;
    };

    const renderUser = (data, me) => {
        const { user, reminders, recentEntries, summary } = data;
        const isMe = user.id === me.id;

        $("drawer-title").textContent = displayName(user);

        const actions = el("div", { className: "actions" },
            !user.emailVerified && actionButton("Mark email verified", "", async () => {
                await api(`/admin/users/${user.id}`, {
                    method: "PATCH",
                    body: { emailVerified: true }
                });
                toast("Email marked as verified");
                await refreshAfterChange(user.id);
            }),

            !isMe && actionButton(
                user.isAdmin ? "Remove admin" : "Make admin",
                "",
                async () => {
                    const verb = user.isAdmin ? "Remove admin access from" : "Give admin access to";

                    if (!confirm(`${verb} ${user.email}?`)) {
                        return;
                    }

                    await api(`/admin/users/${user.id}`, {
                        method: "PATCH",
                        body: { isAdmin: !user.isAdmin }
                    });
                    toast(user.isAdmin ? "Admin access removed" : "Admin access granted");
                    await refreshAfterChange(user.id);
                }
            ),

            !isMe && actionButton("Sign out everywhere", "", async () => {
                const result = await api(`/admin/users/${user.id}/logout`, { method: "POST" });
                toast(`Signed out of ${result.sessionsRevoked} session(s)`);
                await refreshAfterChange(user.id);
            }),

            !isMe && actionButton("Delete user", "btn-danger", async () => {
                const typed = prompt(
                    "This permanently deletes the account and all tracking data.\n\n" +
                    `Type the user's email to confirm:\n${user.email}`
                );

                if (typed === null) {
                    return;
                }

                if (typed.trim().toLowerCase() !== user.email) {
                    toast("Email didn't match — nothing was deleted", true);
                    return;
                }

                await api(`/admin/users/${user.id}`, { method: "DELETE" });
                toast("User deleted");
                closeDrawer();
                await Promise.all([loadOverview(), loadUsers()]);
            })
        );

        const entriesSection = recentEntries.length === 0
            ? el("p", { className: "muted" }, "No tracking entries yet.")
            : el("div", { className: "table-wrap" },
                el("table", { className: "entries" },
                    el("thead", {},
                        el("tr", {},
                            el("th", {}, "Date"),
                            el("th", {}, "Night"),
                            el("th", {}, "Fluids"),
                            el("th", {}, "Activity"),
                            el("th", {}, "Stress"),
                            el("th", {}, "Sleep")
                        )
                    ),
                    el("tbody", {},
                        ...recentEntries.flatMap((entry) => {
                            const rows = [
                                el("tr", {},
                                    el("td", {}, formatDate(String(entry.entryDate).slice(0, 10))),
                                    el("td", {}, entry.nightTimeUrination),
                                    el("td", {}, entry.eveningFluids),
                                    el("td", {}, entry.activityLevel),
                                    el("td", {}, `${entry.stressLevel}/5`),
                                    el("td", {}, entry.sleepQuality)
                                )
                            ];

                            if (entry.notes) {
                                rows.push(el("tr", {},
                                    el("td", { colSpan: 6, className: "note" }, entry.notes)));
                            }

                            return rows;
                        })
                    )
                )
            );

        $("drawer-body").replaceChildren(
            el("section", {},
                el("h3", {}, "Account"),
                kv([
                    ["Email", user.email],
                    ["Status", el("span", {}, ...statusBadges(user))],
                    ["Joined", formatDateTime(user.createdAt)],
                    ["Last sign-in", formatDateTime(user.lastLoginAt)],
                    ["Active sessions", formatNumber(user.activeSessions)],
                    ["Reminders", reminders.remindersEnabled
                        ? `On (${reminders.frequency})`
                        : "Off"],
                    ["Last reminded", formatDateTime(reminders.lastRemindedAt)],
                    ["User ID", el("code", {}, user.id)]
                ]),
                isMe
                    ? el("p", { className: "muted" }, "This is your account.")
                    : null,
                actions
            ),

            el("section", {},
                el("h3", {}, "Last 30 days"),
                el("div", { className: "mini-stats" },
                    el("div", { className: "stat" },
                        el("div", { className: "stat-label" }, "Days tracked"),
                        el("div", { className: "stat-value" },
                            `${summary.adherence.daysTracked}/${summary.adherence.expectedDays}`),
                        el("div", { className: "stat-sub" }, `${summary.adherence.percent}% adherence`)
                    ),
                    el("div", { className: "stat" },
                        el("div", { className: "stat-label" }, "Night trips / night"),
                        el("div", { className: "stat-value" },
                            formatNumber(summary.nightTimeUrination.averagePerNight)),
                        el("div", { className: "stat-sub" },
                            trendText(summary.nightTimeUrination.trend))
                    ),
                    el("div", { className: "stat" },
                        el("div", { className: "stat-label" }, "Sleep quality (1–3)"),
                        el("div", { className: "stat-value" },
                            formatNumber(summary.sleepQuality.average)),
                        el("div", { className: "stat-sub" },
                            trendText(summary.sleepQuality.trend))
                    )
                )
            ),

            el("section", {},
                el("h3", {}, `Recent entries (${formatNumber(user.entryCount)} total)`),
                entriesSection
            )
        );
    };

    let currentAdmin = null;

    const openUser = async (userId) => {
        state.selectedUserId = userId;

        $("drawer-title").textContent = "Loading…";
        $("drawer-body").replaceChildren(el("p", { className: "muted" }, "Loading user…"));
        $("drawer").hidden = false;
        $("drawer-backdrop").hidden = false;

        try {
            const data = await api(`/admin/users/${encodeURIComponent(userId)}`);

            // Ignore stale responses if another user was opened meanwhile.
            if (state.selectedUserId === userId) {
                renderUser(data, currentAdmin);
            }
        } catch (error) {
            closeDrawer();
            handleError(error);
        }
    };

    const refreshAfterChange = async (userId) => {
        await Promise.all([loadOverview(), loadUsers()]);
        await openUser(userId);
    };


    // ============================================================
    // BOOT
    // ============================================================

    const handleError = (error) => {
        if (error.status === 401) {
            closeDrawer();
            showView("login");
            toast("Your session has ended — please sign in again", true);
            return;
        }

        toast(error.message || "Something went wrong", true);
    };

    const loadAll = async () => {
        await Promise.all([loadOverview(), loadUsers()]);
    };

    $("refresh").addEventListener("click", () => {
        loadAll()
            .then(() => toast("Dashboard refreshed"))
            .catch(handleError);
    });

    const boot = async () => {
        try {
            const { user } = await api("/profile");
            currentAdmin = user;
        } catch (error) {
            if (error.status === 401) {
                showView("login");
                return;
            }

            throw error;
        }

        try {
            await loadAll();
            showView("app");
        } catch (error) {
            if (error.status === 403) {
                $("denied-email").textContent = currentAdmin.email;
                showView("denied");
                return;
            }

            throw error;
        }
    };

    boot().catch((error) => {
        showView("login");
        showLoginError(error.message || "Couldn't reach the server");
    });
})();
