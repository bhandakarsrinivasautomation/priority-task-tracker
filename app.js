"use strict";

/* =====================================================
   STATE
===================================================== */
let currentUser = null;
let isAdmin = false;
let myTasks = [];          // tasks for logged-in user (realtime)
let allTasks = [];         // all users' tasks (admin only, realtime)
let currentFilter = "all";
let currentView = "dashboard";
let editingTaskId = null;

let priorityPieChart = null;
let priorityBarChart = null;
let progressDonutChart = null;
let adminPriorityChart = null;

const PRIORITY_COLORS = { High: "#ff5757", Medium: "#ffb443", Low: "#34c98e" };

let myTasksUnsub = null;
let allTasksUnsub = null;

/* =====================================================
   DOM REFS
===================================================== */
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginError = document.getElementById("loginError");

/* =====================================================
   AUTH
===================================================== */
document.getElementById("googleLoginBtn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  loginError.textContent = "";
  auth.signInWithPopup(provider).catch((err) => {
    console.error(err);
    loginError.textContent = "Sign-in failed: " + err.message;
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    isAdmin = user.email === SUPERADMIN_EMAIL;

    // Upsert a lightweight user profile doc so admin can list all users
    db.collection("users").doc(user.uid).set(
      {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch((e) => console.error("profile upsert failed", e));

    document.getElementById("userName").textContent = user.displayName || "User";
    document.getElementById("userEmail").textContent = user.email || "";
    document.getElementById("userPhoto").src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "U");

    document.getElementById("adminNavBtn").style.display = isAdmin ? "flex" : "none";

    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");

    subscribeMyTasks();
    if (isAdmin) subscribeAllTasks();

    switchView("dashboard");
  } else {
    currentUser = null;
    isAdmin = false;
    if (myTasksUnsub) { myTasksUnsub(); myTasksUnsub = null; }
    if (allTasksUnsub) { allTasksUnsub(); allTasksUnsub = null; }
    myTasks = [];
    allTasks = [];
    appShell.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
});

/* =====================================================
   NAVIGATION
===================================================== */
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.getElementById("dashboardView").classList.toggle("hidden", view !== "dashboard");
  document.getElementById("tasksView").classList.toggle("hidden", view !== "tasks");
  document.getElementById("adminView").classList.toggle("hidden", view !== "admin");

  if (view === "dashboard") renderDashboard();
  if (view === "tasks") renderTaskList();
  if (view === "admin" && isAdmin) renderAdminView();
}

/* =====================================================
   FIRESTORE — MY TASKS (realtime)
===================================================== */
function subscribeMyTasks() {
  if (myTasksUnsub) myTasksUnsub();
  myTasksUnsub = db.collection("tasks")
    .where("uid", "==", currentUser.uid)
    .onSnapshot(
      (snap) => {
        myTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        myTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (currentView === "dashboard") renderDashboard();
        if (currentView === "tasks") renderTaskList();
      },
      (err) => {
        console.error("myTasks snapshot error", err);
        showToast("Error loading tasks: " + err.message);
      }
    );
}

function subscribeAllTasks() {
  if (allTasksUnsub) allTasksUnsub();
  allTasksUnsub = db.collection("tasks").onSnapshot(
    (snap) => {
      allTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (currentView === "admin") renderAdminView();
    },
    (err) => {
      console.error("allTasks snapshot error", err);
      showToast("Error loading admin data: " + err.message);
    }
  );
}

/* =====================================================
   TASK MODAL (Add / Edit)
===================================================== */
const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");

function openTaskModal(task) {
  editingTaskId = task ? task.id : null;
  document.getElementById("modalTitle").textContent = task ? "Edit Task" : "New Task";
  document.getElementById("taskId").value = task ? task.id : "";
  document.getElementById("taskTitle").value = task ? task.title : "";
  document.getElementById("taskDescription").value = task ? task.description || "" : "";
  document.getElementById("taskPriority").value = task ? task.priority : "Medium";
  document.getElementById("taskDueDate").value = task ? task.dueDate || "" : "";
  document.getElementById("taskCompleted").checked = task ? !!task.completed : false;
  document.getElementById("deleteTaskBtn").classList.toggle("hidden", !task);
  taskModal.classList.remove("hidden");
}

function closeTaskModal() {
  taskModal.classList.add("hidden");
  taskForm.reset();
  editingTaskId = null;
}

document.getElementById("addTaskBtnDash").addEventListener("click", () => openTaskModal(null));
document.getElementById("addTaskBtnTasks").addEventListener("click", () => openTaskModal(null));
document.getElementById("closeModalBtn").addEventListener("click", closeTaskModal);
taskModal.addEventListener("click", (e) => { if (e.target === taskModal) closeTaskModal(); });

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;

  const data = {
    title,
    description: document.getElementById("taskDescription").value.trim(),
    priority: document.getElementById("taskPriority").value,
    dueDate: document.getElementById("taskDueDate").value || null,
    completed: document.getElementById("taskCompleted").checked,
    uid: currentUser.uid,
    ownerName: currentUser.displayName || "",
    ownerEmail: currentUser.email || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (editingTaskId) {
      await db.collection("tasks").doc(editingTaskId).update(data);
      showToast("Task updated ✅");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("tasks").add(data);
      showToast("Task added ✅");
    }
    closeTaskModal();
  } catch (err) {
    console.error(err);
    showToast("Error: " + err.message);
  }
});

document.getElementById("deleteTaskBtn").addEventListener("click", async () => {
  if (!editingTaskId) return;
  if (!confirm("Delete this task permanently?")) return;
  try {
    await db.collection("tasks").doc(editingTaskId).delete();
    showToast("Task deleted 🗑️");
    closeTaskModal();
  } catch (err) {
    console.error(err);
    showToast("Error: " + err.message);
  }
});

async function toggleComplete(task) {
  try {
    await db.collection("tasks").doc(task.id).update({
      completed: !task.completed,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    showToast("Error: " + err.message);
  }
}

/* =====================================================
   DASHBOARD RENDER
===================================================== */
function renderDashboard() {
  const total = myTasks.length;
  const high = myTasks.filter((t) => t.priority === "High").length;
  const medium = myTasks.filter((t) => t.priority === "Medium").length;
  const low = myTasks.filter((t) => t.priority === "Low").length;
  const done = myTasks.filter((t) => t.completed).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statHigh").textContent = high;
  document.getElementById("statMedium").textContent = medium;
  document.getElementById("statLow").textContent = low;
  document.getElementById("statDone").textContent = done;

  renderPieChart(high, medium, low);
  renderBarChart();
  renderDonutChart(done, total - done);
  renderPriorityGroups();
}

function renderPieChart(high, medium, low) {
  const ctx = document.getElementById("priorityPieChart");
  if (priorityPieChart) priorityPieChart.destroy();
  priorityPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        data: [high, medium, low],
        backgroundColor: [PRIORITY_COLORS.High, PRIORITY_COLORS.Medium, PRIORITY_COLORS.Low],
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom", labels: { font: { family: "Poppins", size: 12 }, padding: 14 } } },
    },
  });
}

function renderBarChart() {
  const ctx = document.getElementById("priorityBarChart");
  const priorities = ["High", "Medium", "Low"];
  const doneData = priorities.map((p) => myTasks.filter((t) => t.priority === p && t.completed).length);
  const pendingData = priorities.map((p) => myTasks.filter((t) => t.priority === p && !t.completed).length);

  if (priorityBarChart) priorityBarChart.destroy();
  priorityBarChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: priorities,
      datasets: [
        { label: "Completed", data: doneData, backgroundColor: "#7c5cff", borderRadius: 6 },
        { label: "Pending", data: pendingData, backgroundColor: "#d8d6e8", borderRadius: 6 },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      plugins: { legend: { position: "bottom", labels: { font: { family: "Poppins", size: 12 } } } },
    },
  });
}

function renderDonutChart(done, pending) {
  const ctx = document.getElementById("progressDonutChart");
  if (progressDonutChart) progressDonutChart.destroy();
  progressDonutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending"],
      datasets: [{
        data: [done, pending],
        backgroundColor: ["#7c5cff", "#f0f0f8"],
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      cutout: "70%",
      plugins: { legend: { position: "bottom", labels: { font: { family: "Poppins", size: 12 }, padding: 14 } } },
    },
  });
}

function renderPriorityGroups() {
  const container = document.getElementById("dashboardPriorityGroups");
  container.innerHTML = "";
  const priorities = [
    { key: "High", emoji: "🔴", color: PRIORITY_COLORS.High },
    { key: "Medium", emoji: "🟡", color: PRIORITY_COLORS.Medium },
    { key: "Low", emoji: "🟢", color: PRIORITY_COLORS.Low },
  ];

  priorities.forEach((p) => {
    const tasks = myTasks.filter((t) => t.priority === p.key && !t.completed).slice(0, 5);
    if (tasks.length === 0) return;

    const group = document.createElement("div");
    group.innerHTML = `<div class="priority-group-title" style="color:${p.color}">${p.emoji} ${p.key} Priority — Needs Attention</div>`;
    const list = document.createElement("div");
    list.className = "task-list";
    tasks.forEach((t) => list.appendChild(buildTaskCard(t, false)));
    group.appendChild(list);
    container.appendChild(group);
  });
}

/* =====================================================
   MY TASKS VIEW
===================================================== */
document.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderTaskList();
  });
});

function renderTaskList() {
  const container = document.getElementById("taskListContainer");
  const noTasksMsg = document.getElementById("noTasksMsg");
  container.innerHTML = "";

  let filtered = myTasks;
  if (currentFilter === "Completed") {
    filtered = myTasks.filter((t) => t.completed);
  } else if (currentFilter !== "all") {
    filtered = myTasks.filter((t) => t.priority === currentFilter);
  }

  if (filtered.length === 0) {
    noTasksMsg.classList.remove("hidden");
    return;
  }
  noTasksMsg.classList.add("hidden");
  filtered.forEach((t) => container.appendChild(buildTaskCard(t, false)));
}

function buildTaskCard(task, showOwner) {
  const card = document.createElement("div");
  card.className = `task-card priority-${task.priority}${task.completed ? " completed" : ""}`;

  const check = document.createElement("div");
  check.className = `task-check${task.completed ? " checked" : ""}`;
  check.textContent = task.completed ? "✓" : "";
  check.addEventListener("click", (e) => { e.stopPropagation(); toggleComplete(task); });

  const body = document.createElement("div");
  body.className = "task-body";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const desc = document.createElement("div");
  desc.className = "task-desc";
  desc.textContent = task.description || "";
  if (!task.description) desc.style.display = "none";

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.innerHTML = `
    <span class="badge badge-${task.priority}">${task.priority}</span>
    ${task.completed ? '<span class="badge badge-done">Completed</span>' : ""}
    ${task.dueDate ? `<span class="badge badge-date">📅 ${task.dueDate}</span>` : ""}
  `;

  body.appendChild(title);
  if (task.description) body.appendChild(desc);
  body.appendChild(meta);

  if (showOwner) {
    const owner = document.createElement("div");
    owner.className = "task-owner";
    owner.textContent = `👤 ${task.ownerName || "Unknown"} (${task.ownerEmail || "—"})`;
    body.appendChild(owner);
  }

  card.appendChild(check);
  card.appendChild(body);

  card.addEventListener("click", () => openTaskModal(task));

  return card;
}

/* =====================================================
   ADMIN VIEW
===================================================== */
let adminSearchTerm = "";
document.getElementById("adminSearchInput").addEventListener("input", (e) => {
  adminSearchTerm = e.target.value.trim().toLowerCase();
  renderAdminTaskList();
});

function renderAdminView() {
  const uniqueUsers = new Set(allTasks.map((t) => t.uid));
  const high = allTasks.filter((t) => t.priority === "High").length;
  const medium = allTasks.filter((t) => t.priority === "Medium").length;
  const low = allTasks.filter((t) => t.priority === "Low").length;
  const done = allTasks.filter((t) => t.completed).length;

  document.getElementById("adminStatUsers").textContent = uniqueUsers.size;
  document.getElementById("adminStatTasks").textContent = allTasks.length;
  document.getElementById("adminStatHigh").textContent = high;
  document.getElementById("adminStatDone").textContent = done;

  const ctx = document.getElementById("adminPriorityChart");
  if (adminPriorityChart) adminPriorityChart.destroy();
  adminPriorityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        label: "Tasks",
        data: [high, medium, low],
        backgroundColor: [PRIORITY_COLORS.High, PRIORITY_COLORS.Medium, PRIORITY_COLORS.Low],
        borderRadius: 8,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  renderAdminTaskList();
}

function renderAdminTaskList() {
  const container = document.getElementById("adminTaskListContainer");
  container.innerHTML = "";

  let filtered = allTasks;
  if (adminSearchTerm) {
    filtered = filtered.filter(
      (t) =>
        (t.ownerName || "").toLowerCase().includes(adminSearchTerm) ||
        (t.ownerEmail || "").toLowerCase().includes(adminSearchTerm)
    );
  }

  if (filtered.length === 0) {
    const msg = document.createElement("p");
    msg.className = "empty-msg";
    msg.textContent = "No matching tasks found.";
    container.appendChild(msg);
    return;
  }

  filtered.forEach((task) => container.appendChild(buildAdminTaskCard(task)));
}

function buildAdminTaskCard(task) {
  const card = document.createElement("div");
  card.className = `task-card priority-${task.priority}${task.completed ? " completed" : ""}`;
  card.style.cursor = "default";

  const check = document.createElement("div");
  check.className = `task-check${task.completed ? " checked" : ""}`;
  check.textContent = task.completed ? "✓" : "";

  const body = document.createElement("div");
  body.className = "task-body";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const desc = document.createElement("div");
  desc.className = "task-desc";
  desc.textContent = task.description || "";
  if (!task.description) desc.style.display = "none";

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const badge = document.createElement("span");
  badge.className = `badge badge-${task.priority}`;
  badge.textContent = task.priority;
  meta.appendChild(badge);

  if (task.completed) {
    const doneBadge = document.createElement("span");
    doneBadge.className = "badge badge-done";
    doneBadge.textContent = "Completed";
    meta.appendChild(doneBadge);
  }
  if (task.dueDate) {
    const dateBadge = document.createElement("span");
    dateBadge.className = "badge badge-date";
    dateBadge.textContent = `📅 ${task.dueDate}`;
    meta.appendChild(dateBadge);
  }

  // Priority change select — superadmin only
  const select = document.createElement("select");
  select.className = "priority-select-inline";
  ["High", "Medium", "Low"].forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = "Set: " + p;
    if (p === task.priority) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("change", async (e) => {
    e.stopPropagation();
    try {
      await db.collection("tasks").doc(task.id).update({
        priority: select.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast(`Priority updated to ${select.value} ✅`);
    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message);
    }
  });
  meta.appendChild(select);

  body.appendChild(title);
  if (task.description) body.appendChild(desc);
  body.appendChild(meta);

  const owner = document.createElement("div");
  owner.className = "task-owner";
  owner.textContent = `👤 ${task.ownerName || "Unknown"} (${task.ownerEmail || "—"})`;
  body.appendChild(owner);

  card.appendChild(check);
  card.appendChild(body);
  return card;
}

/* =====================================================
   TOAST
===================================================== */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}
