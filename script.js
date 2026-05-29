/* ═══════════════════════════════════════════════════════
   SIM-NS  ·  Standalone Static Export  ·  script.js
   Full UI logic: routing, localStorage state, CRUD,
   modals, search, CSV export, OTP, copy badges
   ═══════════════════════════════════════════════════════ */

// ─── STATE ──────────────────────────────────────────────
const KEYS = { emp: "simns_employees", notif: "simns_notifications", audit: "simns_auditLogs" };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function loadState() {
  return {
    employees:     JSON.parse(localStorage.getItem(KEYS.emp)   || "[]"),
    notifications: JSON.parse(localStorage.getItem(KEYS.notif) || "[]"),
    auditLogs:     JSON.parse(localStorage.getItem(KEYS.audit) || "[]"),
  };
}

function saveState(s) {
  localStorage.setItem(KEYS.emp,   JSON.stringify(s.employees));
  localStorage.setItem(KEYS.notif, JSON.stringify(s.notifications));
  localStorage.setItem(KEYS.audit, JSON.stringify(s.auditLogs));
}

let STATE = loadState();
let currentUser = "hradmin";

// ─── DOMAIN HELPERS ─────────────────────────────────────
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString("en-US");
}

function getStepUpInfo(dateHired, lastStepUpDate) {
  const now  = new Date();
  const last = lastStepUpDate ? new Date(lastStepUpDate) : new Date(dateHired);
  const next = new Date(last);
  next.setFullYear(last.getFullYear() + 3);
  const totalMs = 3 * 365.25 * 24 * 60 * 60 * 1000;
  const elapsed = now - last;
  const progress = Math.min(100, Math.round((elapsed / totalMs) * 100));
  const diffMs = next - now;
  const monthsRemaining = Math.max(0, Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000)));
  const daysRemaining   = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const isEligible      = next <= now;
  return { progress, nextStepDate: next.toLocaleDateString("en-US"), monthsRemaining, daysRemaining, isEligible };
}

const AUDIT_LABELS = {
  add_employee:       "Employee Added",
  update_employee:    "Employee Updated",
  terminate_employee: "Employee Terminated",
  approve_increment:  "Increment Approved",
  login:              "System Access",
};

const AUDIT_TITLES = {
  add_employee:       "New employee record created",
  update_employee:    "Employee record updated",
  terminate_employee: "Employee record terminated",
  approve_increment:  "Step-up increment approved",
  login:              "User logged in successfully",
};

const BADGE_CLASSES = {
  add_employee:       "badge-blue",
  update_employee:    "badge-amber",
  terminate_employee: "badge-red",
  approve_increment:  "badge-green",
  login:              "badge-gray",
};

function addAuditLog(action, employeeId, employeeName, details) {
  STATE.auditLogs.unshift({
    id: uid(), action,
    employeeId:   employeeId   || null,
    employeeName: employeeName || null,
    performedBy:  currentUser  || "hradmin",
    details:      details      || null,
    createdAt:    Date.now(),
  });
  saveState(STATE);
}

// ─── TOAST ──────────────────────────────────────────────
function showToast(msg, type = "default") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = "toast" + (type !== "default" ? " " + type : "");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ─── ESCAPE HTML ────────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── ROUTING ────────────────────────────────────────────
let currentPage = "dashboard";

function showScreen(id) {
  document.querySelectorAll("#screen-login, #screen-app").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  renderPage(page);
}

function renderPage(page) {
  if (page === "dashboard")          renderDashboard();
  else if (page === "employees")     renderEmployees();
  else if (page === "increment-tracking") renderIncrementTracking();
  else if (page === "notifications") renderNotifications();
  else if (page === "audit-log")     renderAuditLog();
  updateNotifBadge();
}

// ─── LOGIN ──────────────────────────────────────────────
let loginView = "login";   // "login" | "forgot" | "otp"
let otpTimer = null;
let otpSeconds = 225;
let otpAttempts = 3;
let otpLocked = false;

function showLoginView(view) {
  loginView = view;
  document.getElementById("lv-login").classList.toggle("hidden", view !== "login");
  document.getElementById("lv-forgot").classList.toggle("hidden", view !== "forgot");
  document.getElementById("lv-otp").classList.toggle("hidden", view !== "otp");
  if (view === "otp") startOtpTimer();
}

function startOtpTimer() {
  clearInterval(otpTimer);
  otpSeconds = 225;
  renderOtpTimer();
  otpTimer = setInterval(() => {
    if (otpSeconds > 0) { otpSeconds--; renderOtpTimer(); }
    else clearInterval(otpTimer);
  }, 1000);
}

function renderOtpTimer() {
  const m = Math.floor(otpSeconds / 60);
  const s = otpSeconds % 60;
  const el = document.getElementById("otp-timer");
  if (!el) return;
  el.textContent = m + ":" + String(s).padStart(2, "0");
  el.style.color = otpSeconds < 60 ? "#ef4444" : "#153084";
}

function handleLogin() {
  const u = document.getElementById("l-username").value.trim();
  const p = document.getElementById("l-password").value.trim();
  const errEl = document.getElementById("l-error");
  if (!u || !p) { errEl.textContent = "Please enter your username and password."; errEl.classList.remove("hidden"); return; }
  if (u !== "hradmin" || p !== "simns2026") { errEl.textContent = "Invalid credentials. Please check your username and password."; errEl.classList.remove("hidden"); return; }
  errEl.classList.add("hidden");
  currentUser = u;
  addAuditLog("login", null, "hradmin", "User logged in successfully");
  showScreen("screen-app");
  navigateTo("dashboard");
}

function handleForgotSend() {
  otpAttempts = 3;
  otpLocked = false;
  document.getElementById("otp-digits").innerHTML = buildOtpInputs();
  document.getElementById("otp-err").classList.add("hidden");
  document.getElementById("otp-locked-msg").classList.add("hidden");
  document.getElementById("otp-success-msg").classList.remove("hidden");
  document.getElementById("otp-submit-btn").disabled = false;
  showLoginView("otp");
  setTimeout(() => document.querySelector(".otp-input")?.focus(), 50);
}

function buildOtpInputs() {
  return [0,1,2,3,4,5].map(i =>
    `<input class="otp-input" maxlength="1" inputmode="numeric"
      oninput="otpInput(this,${i})" onkeydown="otpKeydown(event,${i})" />`
  ).join("");
}

function buildOtpLocked() {
  return [0,1,2,3,4,5].map(() => `<div class="otp-locked-box">🔒</div>`).join("");
}

function otpInput(el, idx) {
  el.value = el.value.replace(/\D/g,"").slice(-1);
  if (el.value) {
    const next = document.querySelectorAll(".otp-input")[idx + 1];
    if (next) next.focus();
  }
}

function otpKeydown(e, idx) {
  if (e.key === "Backspace" && !e.target.value && idx > 0) {
    document.querySelectorAll(".otp-input")[idx - 1]?.focus();
  }
}

function handleVerifyOtp() {
  if (otpLocked) return;
  const inputs = document.querySelectorAll(".otp-input");
  const code = [...inputs].map(i => i.value).join("");
  if (code.length < 6) { showToast("Please enter all 6 digits.", "red"); return; }
  if (code === "123456") {
    clearInterval(otpTimer);
    addAuditLog("login", null, "hradmin", "User logged in via OTP");
    showScreen("screen-app");
    navigateTo("dashboard");
    return;
  }
  otpAttempts--;
  document.querySelectorAll(".otp-input").forEach(i => i.value = "");
  setTimeout(() => document.querySelector(".otp-input")?.focus(), 50);
  if (otpAttempts <= 0) {
    otpLocked = true;
    clearInterval(otpTimer);
    document.getElementById("otp-digits").innerHTML = buildOtpLocked();
    document.getElementById("otp-success-msg").classList.add("hidden");
    document.getElementById("otp-locked-msg").classList.remove("hidden");
    document.getElementById("otp-err").classList.add("hidden");
    document.getElementById("otp-submit-btn").disabled = true;
    document.getElementById("otp-locked-actions").classList.remove("hidden");
    document.getElementById("otp-resend-row").classList.add("hidden");
  } else {
    const errEl = document.getElementById("otp-err");
    errEl.textContent = `Incorrect Code: You have ${otpAttempts} attempt${otpAttempts === 1 ? "" : "s"} remaining.`;
    errEl.classList.remove("hidden");
  }
}

function returnToLogin() {
  clearInterval(otpTimer);
  otpLocked = false; otpAttempts = 3;
  document.getElementById("l-error").classList.add("hidden");
  showLoginView("login");
}

// ── Credential copy buttons ─────────────────────────────
function copyCredential(text, which) {
  navigator.clipboard.writeText(text).then(() => {
    const badge = document.getElementById("copied-badge-" + which);
    badge.classList.remove("hidden");
    setTimeout(() => badge.classList.add("hidden"), 1500);
  });
}

// ── Toggle password visibility ──────────────────────────
let pwVisible = false;
function togglePw() {
  pwVisible = !pwVisible;
  const inp = document.getElementById("l-password");
  inp.type = pwVisible ? "text" : "password";
  document.getElementById("pw-eye").innerHTML = pwVisible
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ─── DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  let dueThisMonth = 0, flagged = 0;
  STATE.employees.forEach(emp => {
    const { isEligible, daysRemaining } = getStepUpInfo(emp.dateHired, emp.lastStepUpDate);
    if (isEligible) flagged++;
    else if (daysRemaining >= 0 && daysRemaining <= 30) dueThisMonth++;
  });
  const unread = STATE.notifications.filter(n => !n.isRead).length;
  const lastLoginStr = now.toLocaleString("en-US", { month:"numeric",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true });
  const todayStr = now.toLocaleDateString("en-US");

  document.getElementById("wb-login-time").textContent = "Last login: " + lastLoginStr + " · " + currentUser;
  document.getElementById("wb-today").textContent = todayStr;
  document.getElementById("metric-total").textContent   = STATE.employees.length;
  document.getElementById("metric-due").textContent     = dueThisMonth;
  document.getElementById("metric-flagged").textContent = flagged;
  document.getElementById("metric-unread").textContent  = unread;
  document.getElementById("status-time").textContent    = "All modules are functioning normally. Last system check: " + lastLoginStr;

  const alertsList = document.getElementById("recent-alerts-list");
  const recent = STATE.notifications.slice(0, 5);
  alertsList.innerHTML = recent.length === 0
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0">No recent system alerts</p>`
    : recent.map(n => `<li style="border-bottom:1px solid #f3f4f6;padding-bottom:8px;margin-bottom:8px">
        <p style="font-size:12px;font-weight:600;color:#1a1a2e">${esc(n.message)}</p>
        <p style="font-size:11px;color:#9ca3af">${fmtDateTime(n.createdAt)}</p>
      </li>`).join("");

  const deadlinesList = document.getElementById("upcoming-deadlines-list");
  const upcoming = STATE.employees
    .map(e => ({ e, info: getStepUpInfo(e.dateHired, e.lastStepUpDate) }))
    .filter(({ info }) => !info.isEligible && info.daysRemaining >= 0 && info.daysRemaining <= 90)
    .sort((a, b) => a.info.daysRemaining - b.info.daysRemaining);
  deadlinesList.innerHTML = upcoming.length === 0
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0">No upcoming deadlines in the next 90 days</p>`
    : upcoming.map(({ e, info }) => `
      <li style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f6;padding-bottom:8px;margin-bottom:8px">
        <div>
          <p style="font-size:12px;font-weight:600;color:#1a1a2e">${esc(e.name)}</p>
          <p style="font-size:11px;color:#9ca3af">${esc(e.position)}</p>
        </div>
        <span style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;white-space:nowrap">${info.daysRemaining}d left</span>
      </li>`).join("");
}

// ─── EMPLOYEES ──────────────────────────────────────────
let empSearch = "";
let empCopiedId = null;
let empCopiedTimer = null;

function renderEmployees() {
  const now = new Date();
  const filtered = STATE.employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.position.toLowerCase().includes(empSearch.toLowerCase())
  );
  const tableWrap = document.getElementById("emp-table-wrap");
  const emptyWrap = document.getElementById("emp-empty");
  document.getElementById("emp-count").textContent = STATE.employees.length + " employee" + (STATE.employees.length !== 1 ? "s" : "");

  if (filtered.length === 0) {
    tableWrap.classList.add("hidden");
    emptyWrap.classList.remove("hidden");
    document.getElementById("emp-empty-title").textContent = empSearch ? "No results found" : "No employees yet";
    document.getElementById("emp-empty-desc").textContent  = empSearch ? `No employees match "${empSearch}"` : "Add your first employee to get started";
    document.getElementById("emp-empty-add-btn").style.display = empSearch ? "none" : "inline-flex";
  } else {
    tableWrap.classList.remove("hidden");
    emptyWrap.classList.add("hidden");
    document.getElementById("emp-tbody").innerHTML = filtered.map(emp => {
      const { isEligible, daysRemaining } = getStepUpInfo(emp.dateHired, emp.lastStepUpDate);
      const last = emp.lastStepUpDate ? new Date(emp.lastStepUpDate) : new Date(emp.dateHired);
      const next = new Date(last); next.setFullYear(last.getFullYear() + 3);
      const isDueSoon = !isEligible && next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth();
      const badge = isEligible
        ? `<span class="badge badge-red">Requires Action</span>`
        : (isDueSoon || daysRemaining <= 30)
          ? `<span class="badge badge-amber">Eligible Now</span>`
          : `<span class="badge badge-gray">Active</span>`;

      const isCopied = empCopiedId === emp.id;
      const copyBtn = isCopied
        ? `<span class="emp-copied-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Copied!
           </span>`
        : `<button class="btn-copy-emp" onclick="copyEmpName('${emp.id}','${esc(emp.name).replace(/'/g,"\\'")}',this)" title="Copy name">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           </button>`;

      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div>
              <p style="font-size:13px;font-weight:500">${esc(emp.name)}</p>
              <p style="font-size:11px;color:#6b7280">${esc(emp.position)}</p>
            </div>
            ${copyBtn}
          </div>
        </td>
        <td>${badge}</td>
        <td>SG-${emp.salaryGrade}</td>
        <td>${emp.dateHired}</td>
        <td>${emp.lastStepUpDate || "—"}</td>
        <td>${emp.promotionHistory || "—"}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-icon blue" onclick="openEditModal('${emp.id}')" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#153084" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon red" onclick="openTerminateModal('${emp.id}')" title="Terminate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }
}

function copyEmpName(id, name) {
  navigator.clipboard.writeText(name).then(() => {
    empCopiedId = id;
    clearTimeout(empCopiedTimer);
    renderEmployees();
    empCopiedTimer = setTimeout(() => { empCopiedId = null; renderEmployees(); }, 1800);
  });
}

// ─── INCREMENT TRACKING ─────────────────────────────────
function renderIncrementTracking() {
  const tableWrap = document.getElementById("inc-table-wrap");
  const emptyWrap = document.getElementById("inc-empty");
  if (STATE.employees.length === 0) {
    tableWrap.classList.add("hidden"); emptyWrap.classList.remove("hidden");
  } else {
    tableWrap.classList.remove("hidden"); emptyWrap.classList.add("hidden");
    document.getElementById("inc-tbody").innerHTML = STATE.employees.map((emp, idx) => {
      const { progress, nextStepDate, monthsRemaining, isEligible } = getStepUpInfo(emp.dateHired, emp.lastStepUpDate);
      const badge = isEligible
        ? `<span class="badge badge-red">Requires Action</span>`
        : monthsRemaining <= 3
          ? `<span class="badge badge-amber">Due Soon (${monthsRemaining}mo)</span>`
          : `<span class="badge badge-gray">${monthsRemaining} months left</span>`;
      return `<tr>
        <td style="color:#9ca3af">${idx+1}</td>
        <td><p style="font-size:13px;font-weight:500">${esc(emp.name)}</p><p style="font-size:11px;color:#6b7280">${esc(emp.position)}</p></td>
        <td>${emp.dateHired}</td>
        <td>${emp.lastStepUpDate || "—"}</td>
        <td>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill ${isEligible?"red":"blue"}" style="width:${progress}%"></div></div>
            <span class="progress-pct">${progress}%</span>
          </div>
        </td>
        <td>${nextStepDate}</td>
        <td>${badge}</td>
      </tr>`;
    }).join("");
  }
}

// ─── NOTIFICATIONS ──────────────────────────────────────
function renderNotifications() {
  const eligible = STATE.notifications.filter(n => !n.isApproved && !n.isRead).length;
  const due      = STATE.notifications.filter(n => !n.isApproved).length;
  document.getElementById("notif-eligible-count").textContent = eligible;
  document.getElementById("notif-due-count").textContent      = due;
  document.getElementById("notif-unread-badge").textContent   = STATE.notifications.filter(n=>!n.isRead).length + " Unread";

  const list  = document.getElementById("notif-list");
  const empty = document.getElementById("notif-empty");
  if (STATE.notifications.length === 0) {
    list.classList.add("hidden"); empty.classList.remove("hidden");
  } else {
    list.classList.remove("hidden"); empty.classList.add("hidden");
    list.innerHTML = STATE.notifications.map(n => {
      const emp = STATE.employees.find(e => e.id === n.employeeId);
      const newBadge = !n.isRead ? `<span class="badge-new">New</span>` : "";
      const approveBtn = !n.isApproved
        ? `<button class="btn btn-green" style="font-size:12px;padding:6px 12px" onclick="approveNotif('${n.id}')">Approve Increment ➜</button>` : "";
      const readBtn = !n.isRead
        ? `<button class="btn btn-ghost" style="font-size:12px;padding:6px 10px" onclick="markNotifRead('${n.id}')">Mark Read</button>` : "";
      return `<div class="notif-row">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="notif-body">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
            <span class="notif-name">${esc(emp?.name ?? "Unknown")} is now eligible for step-up increment to SG ${emp ? emp.salaryGrade+1 : "—"}</span>
            ${newBadge}
          </div>
          <p class="notif-meta">Employee ID: ${n.employeeId.slice(-3).toUpperCase()} &nbsp;•&nbsp; Position: ${esc(emp?.position ?? "—")} &nbsp;•&nbsp; Current SG: ${emp?.salaryGrade ?? "—"} &nbsp;•&nbsp; ${fmtDateTime(n.createdAt)}</p>
        </div>
        <div class="notif-actions">${approveBtn}${readBtn}</div>
      </div>`;
    }).join("");
  }
}

function approveNotif(id) {
  const n = STATE.notifications.find(x => x.id === id);
  if (!n) return;
  n.isApproved = true; n.isRead = true;
  const emp = STATE.employees.find(e => e.id === n.employeeId);
  if (emp) {
    emp.salaryGrade += 1;
    emp.lastStepUpDate = new Date().toISOString().slice(0,10);
    addAuditLog("approve_increment", emp.id, emp.name, `Increment approved, now SG-${emp.salaryGrade}`);
  }
  saveState(STATE);
  renderNotifications(); updateNotifBadge();
  showToast("Increment approved successfully!", "green");
}

function markNotifRead(id) {
  const n = STATE.notifications.find(x => x.id === id);
  if (n) { n.isRead = true; saveState(STATE); }
  renderNotifications(); updateNotifBadge();
}

// ─── AUDIT LOG ──────────────────────────────────────────
let auditPage = 0;
const AUDIT_PAGE_SIZE = 20;

function renderAuditLog() {
  const total    = STATE.auditLogs.length;
  const approved = STATE.auditLogs.filter(l => l.action === "approve_increment").length;
  const changes  = STATE.auditLogs.filter(l => ["add_employee","update_employee","terminate_employee"].includes(l.action)).length;
  document.getElementById("audit-total").textContent    = total;
  document.getElementById("audit-approved").textContent = approved;
  document.getElementById("audit-changes").textContent  = changes;

  const list  = document.getElementById("audit-list");
  const empty = document.getElementById("audit-empty");
  const more  = document.getElementById("audit-load-more");

  if (total === 0) {
    list.classList.add("hidden"); empty.classList.remove("hidden"); more.classList.add("hidden");
  } else {
    list.classList.remove("hidden"); empty.classList.add("hidden");
    const pageEnd = (auditPage + 1) * AUDIT_PAGE_SIZE;
    list.innerHTML = STATE.auditLogs.slice(0, pageEnd).map(log => {
      const badgeClass = BADGE_CLASSES[log.action] || "badge-gray";
      return `<div class="audit-row">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge ${badgeClass}">${AUDIT_LABELS[log.action] || log.action}</span>
            <span style="font-size:11px;color:#9ca3af">${fmtDateTime(log.createdAt)}</span>
          </div>
          <p class="audit-title">${esc(AUDIT_TITLES[log.action] || log.details || log.action)}</p>
          <p class="audit-meta">Performed by: <strong>${esc(log.performedBy)}</strong>${log.employeeName ? ` &nbsp;•&nbsp; Employee: <strong>${esc(log.employeeName)}</strong>` : ""}</p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>`;
    }).join("");
    more.classList.toggle("hidden", pageEnd >= total);
  }
}

function exportAuditCSV() {
  const rows = [
    ["Timestamp","Action","Employee","Performed By","Details"],
    ...STATE.auditLogs.map(l => [fmtDateTime(l.createdAt), AUDIT_LABELS[l.action]||l.action, l.employeeName||"—", l.performedBy, l.details||"—"]),
  ];
  const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv],{type:"text/csv"})), download:"audit-log.csv" });
  a.click();
}

// ─── EMPLOYEE MODAL ─────────────────────────────────────
let editingEmpId = null;

function openAddModal() {
  editingEmpId = null;
  document.getElementById("emp-modal-title").textContent  = "Add New Employee";
  document.getElementById("emp-modal-submit").textContent = "Add Employee";
  ["emp-name","emp-position","emp-sg","emp-hired","emp-stepup","emp-promo"].forEach(id => document.getElementById(id).value = "");
  clearEmpErrors();
  showModal("modal-employee");
}

function openEditModal(id) {
  const emp = STATE.employees.find(e => e.id === id);
  if (!emp) return;
  editingEmpId = id;
  document.getElementById("emp-modal-title").textContent  = "Update Employee";
  document.getElementById("emp-modal-submit").textContent = "Update Employee";
  document.getElementById("emp-name").value     = emp.name;
  document.getElementById("emp-position").value = emp.position;
  document.getElementById("emp-sg").value       = emp.salaryGrade;
  document.getElementById("emp-hired").value    = emp.dateHired;
  document.getElementById("emp-stepup").value   = emp.lastStepUpDate || "";
  document.getElementById("emp-promo").value    = emp.promotionHistory || "";
  clearEmpErrors();
  showModal("modal-employee");
}

function clearEmpErrors() {
  ["err-name","err-position","err-sg","err-hired"].forEach(id => document.getElementById(id).textContent = "");
  ["emp-name","emp-position","emp-sg","emp-hired"].forEach(id => document.getElementById(id).classList.remove("error"));
}

function submitEmpForm(e) {
  e.preventDefault();
  clearEmpErrors();
  const name  = document.getElementById("emp-name").value.trim();
  const pos   = document.getElementById("emp-position").value.trim();
  const sgRaw = document.getElementById("emp-sg").value;
  const hired = document.getElementById("emp-hired").value;
  const stepup= document.getElementById("emp-stepup").value;
  const promo = document.getElementById("emp-promo").value.trim();
  let valid = true;
  if (!name)  { setFieldError("emp-name","err-name","Name is required"); valid=false; }
  if (!pos)   { setFieldError("emp-position","err-position","Position is required"); valid=false; }
  const sg = parseInt(sgRaw);
  if (!sgRaw || isNaN(sg) || sg<1 || sg>33) { setFieldError("emp-sg","err-sg","Salary grade must be 1–33"); valid=false; }
  if (!hired) { setFieldError("emp-hired","err-hired","Date hired is required"); valid=false; }
  if (!valid) return;
  const data = { name, position:pos, salaryGrade:sg, dateHired:hired, lastStepUpDate:stepup||null, promotionHistory:promo||null };
  if (editingEmpId) {
    const idx = STATE.employees.findIndex(e => e.id === editingEmpId);
    STATE.employees[idx] = { ...STATE.employees[idx], ...data };
    addAuditLog("update_employee", editingEmpId, name, "Employee record updated");
    showToast("Employee updated successfully.", "green");
  } else {
    const newEmp = { id:uid(), ...data };
    STATE.employees.push(newEmp);
    addAuditLog("add_employee", newEmp.id, name, "New employee record created");
    showToast("Employee added successfully.", "green");
  }
  saveState(STATE);
  hideModal("modal-employee");
  renderEmployees(); updateNotifBadge();
}

function setFieldError(inputId, errId, msg) {
  document.getElementById(inputId).classList.add("error");
  document.getElementById(errId).textContent = msg;
}

// ─── TERMINATE MODAL ────────────────────────────────────
let terminatingEmpId = null;

function openTerminateModal(id) {
  terminatingEmpId = id;
  const emp = STATE.employees.find(e => e.id === id);
  if (!emp) return;
  document.getElementById("terminate-name").textContent = emp.name;
  showModal("modal-terminate");
}

function confirmTerminate() {
  const emp = STATE.employees.find(e => e.id === terminatingEmpId);
  if (!emp) return;
  addAuditLog("terminate_employee", emp.id, emp.name, "Employee record terminated");
  STATE.employees    = STATE.employees.filter(e => e.id !== terminatingEmpId);
  STATE.notifications= STATE.notifications.filter(n => n.employeeId !== terminatingEmpId);
  saveState(STATE);
  hideModal("modal-terminate");
  showToast(`${emp.name} has been terminated.`, "green");
  renderEmployees(); updateNotifBadge();
}

// ─── CHECK ELIGIBILITY ──────────────────────────────────
function checkEligibility() {
  let count = 0;
  STATE.employees.forEach(emp => {
    const { isEligible } = getStepUpInfo(emp.dateHired, emp.lastStepUpDate);
    if (isEligible && !STATE.notifications.some(n => n.employeeId === emp.id && !n.isApproved)) {
      STATE.notifications.unshift({ id:uid(), employeeId:emp.id, message:`${emp.name} is eligible for step-up increment to SG ${emp.salaryGrade+1}`, isRead:false, isApproved:false, createdAt:Date.now() });
      count++;
    }
  });
  saveState(STATE);
  updateNotifBadge();
  if (count > 0) { showToast(`${count} employee(s) flagged as eligible.`, "info"); navigateTo("notifications"); }
  else showToast("No new eligibility changes detected.");
}

// ─── MODAL HELPERS ──────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.remove("hidden"); }
function hideModal(id) { document.getElementById(id).classList.add("hidden"); }

// ─── NOTIF BADGE ────────────────────────────────────────
function updateNotifBadge() {
  const unread = STATE.notifications.filter(n => !n.isRead).length;
  const badge  = document.getElementById("header-notif-badge");
  badge.textContent = unread;
  badge.style.display = unread > 0 ? "flex" : "none";
}

// ─── LOGOUT ─────────────────────────────────────────────
function handleLogout() {
  currentUser = null;
  loginView = "login";
  document.getElementById("l-username").value = "";
  document.getElementById("l-password").value = "";
  document.getElementById("l-error").classList.add("hidden");
  showLoginView("login");
  showScreen("screen-login");
}

// ─── INIT ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Login view switching
  document.getElementById("l-login-btn").addEventListener("click", handleLogin);
  document.getElementById("l-password").addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
  document.getElementById("l-forgot-link").addEventListener("click", () => showLoginView("forgot"));
  document.getElementById("lv-forgot-back").addEventListener("click", () => showLoginView("login"));
  document.getElementById("forgot-send-btn").addEventListener("click", handleForgotSend);
  document.getElementById("otp-verify-btn").addEventListener("click", handleVerifyOtp);
  document.getElementById("otp-submit-btn").addEventListener("click", handleVerifyOtp);
  document.getElementById("otp-return-btn").addEventListener("click", returnToLogin);
  document.getElementById("lv-otp-back").addEventListener("click", () => { clearInterval(otpTimer); showLoginView("forgot"); });
  document.getElementById("pw-toggle").addEventListener("click", togglePw);

  // Initialize OTP digits
  document.getElementById("otp-digits").innerHTML = buildOtpInputs();

  // Nav tabs
  document.querySelectorAll(".nav-tab").forEach(btn => btn.addEventListener("click", () => navigateTo(btn.dataset.page)));

  // Header
  document.getElementById("header-notif-btn").addEventListener("click", () => navigateTo("notifications"));
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Dashboard quick actions
  document.getElementById("qa-add-employee").addEventListener("click", () => { navigateTo("employees"); setTimeout(openAddModal, 50); });
  document.getElementById("qa-view-records").addEventListener("click", () => navigateTo("employees"));
  document.getElementById("qa-check-eligibility").addEventListener("click", checkEligibility);
  document.getElementById("qa-audit-log").addEventListener("click", () => navigateTo("audit-log"));
  document.getElementById("qa-generate-report").addEventListener("click", () => showToast("Report generation coming soon.", "info"));
  document.getElementById("dash-view-all-alerts").addEventListener("click", () => navigateTo("notifications"));
  document.getElementById("dash-view-all-deadlines").addEventListener("click", () => navigateTo("increment-tracking"));

  // Employees page
  document.getElementById("emp-add-btn").addEventListener("click", openAddModal);
  document.getElementById("emp-empty-add-btn").addEventListener("click", openAddModal);
  document.getElementById("emp-search").addEventListener("input", e => { empSearch = e.target.value; renderEmployees(); });

  // Employee modal
  document.getElementById("modal-employee-close").addEventListener("click", () => hideModal("modal-employee"));
  document.getElementById("emp-modal-cancel").addEventListener("click", () => hideModal("modal-employee"));
  document.getElementById("emp-form").addEventListener("submit", submitEmpForm);
  document.getElementById("modal-employee").addEventListener("click", e => { if (e.target === e.currentTarget) hideModal("modal-employee"); });

  // Terminate modal
  document.getElementById("modal-terminate-close").addEventListener("click", () => hideModal("modal-terminate"));
  document.getElementById("terminate-cancel").addEventListener("click", () => hideModal("modal-terminate"));
  document.getElementById("terminate-confirm").addEventListener("click", confirmTerminate);
  document.getElementById("modal-terminate").addEventListener("click", e => { if (e.target === e.currentTarget) hideModal("modal-terminate"); });

  // Audit log
  document.getElementById("audit-export-btn").addEventListener("click", exportAuditCSV);
  document.getElementById("audit-load-more").addEventListener("click", () => { auditPage++; renderAuditLog(); });

  // Start on login screen
  showScreen("screen-login");
  showLoginView("login");
});