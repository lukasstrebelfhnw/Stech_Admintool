// Basis-URL fürs Backend dynamisch aus der aktuellen Origin ableiten
const API_BASE = window.location.origin.replace(":8080", ":8000");

let PROJECTS_CACHE = [];
let CURRENT_USER = {
    id: 1, // ← muss zu deinem Employee passen
    name: "Lukas",
    is_admin: true,
    can_see_kunden_projekte: true,
    can_manage_projects: true,
};

let CURRENT_RUNNING_ENTRY = null; // { id, startTimeStr, dateStr, project_id, activity, is_pause }
let EMPLOYEES_CACHE_ADMIN = [];

// ---------- Helper ----------

function setTodayAsDefaultDate() {
    const dateEl = document.getElementById("time-date");
    const viewDateEl = document.getElementById("time-view-date");
    const today = new Date().toISOString().slice(0, 10);
    if (dateEl && !dateEl.value) dateEl.value = today;
    if (viewDateEl && !viewDateEl.value) viewDateEl.value = today;
}

function parseTimeToMinutes(str) {
    if (!str) return null;
    const [h, m] = str.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

function minutesToHours(min) {
    return min / 60.0;
}

function formatTimeStr(t) {
    if (!t) return "";
    // "HH:MM:SS" → "HH:MM"
    return t.slice(0, 5);
}

function showElement(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = visible ? "block" : "none";
}

function updateTabVisibility() {
    const tabKpBtn = document.querySelector('.tab-btn[data-tab="kp"]');
    const tabTimeBtn = document.querySelector('.tab-btn[data-tab="time"]');
    const tabAdminBtn = document.querySelector('.tab-btn[data-tab="admin"]');

    const tabKpContent = document.getElementById("tab-kp");
    const tabTimeContent = document.getElementById("tab-time");
    const tabAdminContent = document.getElementById("tab-admin");

    const showKp = CURRENT_USER.can_see_kunden_projekte || CURRENT_USER.is_admin;
    if (tabKpBtn) tabKpBtn.style.display = showKp ? "" : "none";
    if (tabKpContent) tabKpContent.style.display = showKp ? "" : "none";

    const showAdmin = CURRENT_USER.is_admin;
    if (tabAdminBtn) tabAdminBtn.style.display = showAdmin ? "" : "none";
    if (tabAdminContent) tabAdminContent.style.display = showAdmin ? "" : "none";

    if (tabTimeBtn) tabTimeBtn.style.display = "";
    if (tabTimeContent) tabTimeContent.style.display = "";
}

// ---------- Backend-Status ----------

async function checkBackend() {
    const statusEl = document.getElementById("api-status");
    try {
        const resp = await fetch(`${API_BASE}/`);
        if (!resp.ok) throw new Error(resp.statusText);
        const data = await resp.json();
        statusEl.textContent = `Backend OK: ${data.msg || "läuft"}`;
        statusEl.style.color = "#22c55e";
    } catch (err) {
        statusEl.textContent = `Backend Fehler: ${err}`;
        statusEl.style.color = "#f97373";
    }
}

// ============================================================
//  K U N D E N
// ============================================================

async function loadCustomers() {
    if (!(CURRENT_USER.can_see_kunden_projekte || CURRENT_USER.is_admin)) {
        const listEl = document.getElementById("customer-list");
        const countEl = document.getElementById("customer-count");
        const errEl = document.getElementById("customer-error");
        if (errEl) errEl.textContent = "Keine Berechtigung für Kundenansicht.";
        if (listEl) listEl.innerHTML = "";
        if (countEl) countEl.textContent = "";
        return;
    }

    const listEl = document.getElementById("customer-list");
    const countEl = document.getElementById("customer-count");
    const errEl = document.getElementById("customer-error");

    if (!listEl || !countEl || !errEl) return;

    errEl.textContent = "";
    listEl.innerHTML = "<div class='small'>Lade Kunden…</div>";

    try {
        const resp = await fetch(`${API_BASE}/customers/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        countEl.textContent = `${data.length} Kunde(n)`;

        if (data.length === 0) {
            listEl.innerHTML = "<div class='small'>Noch keine Kunden angelegt.</div>";
            return;
        }

        listEl.innerHTML = "";
        data.forEach((c) => {
            const div = document.createElement("div");
            div.className = "item";

            const header = document.createElement("div");
            header.className = "item-title";

            const leftSpan = document.createElement("span");
            leftSpan.innerHTML = `${c.firma} <span class="small">#${c.id}</span>`;

            const rightSpan = document.createElement("span");
            if (CURRENT_USER.is_admin) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "Löschen";
                delBtn.className = "btn-danger";
                delBtn.addEventListener("click", async () => {
                    if (!confirm(`Kunde "${c.firma}" (#${c.id}) wirklich löschen?`)) return;
                    try {
                        const resp = await fetch(`${API_BASE}/customers/${c.id}`, {
                            method: "DELETE",
                        });
                        if (!resp.ok) {
                            const txt = await resp.text();
                            throw new Error(`Status ${resp.status}: ${txt}`);
                        }
                        await loadCustomers();
                    } catch (err) {
                        alert("Fehler beim Löschen des Kunden: " + err);
                    }
                });
                rightSpan.appendChild(delBtn);
            }

            header.appendChild(leftSpan);
            header.appendChild(rightSpan);

            const sub = document.createElement("div");
            sub.className = "item-sub";
            sub.textContent = `${c.kontaktperson || "-"}${c.ort ? " · " + c.ort : ""}${c.email ? " · " + c.email : ""}`;

            div.appendChild(header);
            div.appendChild(sub);
            listEl.appendChild(div);
        });
    } catch (err) {
        errEl.textContent = `Fehler beim Laden der Kunden: ${err}`;
        listEl.innerHTML = "";
        countEl.textContent = "";
    }
}

async function createCustomer() {
    if (!(CURRENT_USER.can_see_kunden_projekte || CURRENT_USER.is_admin)) {
        const errEl = document.getElementById("customer-error");
        if (errEl) errEl.textContent = "Keine Berechtigung, Kunden anzulegen.";
        return;
    }
    const firmaEl = document.getElementById("customer-firma");
    const kontaktEl = document.getElementById("customer-kontakt");
    const errEl = document.getElementById("customer-error");
    if (!firmaEl || !kontaktEl || !errEl) return;

    errEl.textContent = "";

    const firma = firmaEl.value.trim();
    const kontakt = kontaktEl.value.trim();

    if (!firma) {
        errEl.textContent = "Bitte eine Firma eingeben.";
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/customers/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firma,
                kontaktperson: kontakt || null,
            }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }
        firmaEl.value = "";
        kontaktEl.value = "";
        await loadCustomers();
    } catch (err) {
        errEl.textContent = `Fehler beim Anlegen: ${err}`;
    }
}

// ============================================================
//  P R O J E K T E
// ============================================================

async function loadProjects() {
    if (!(CURRENT_USER.can_see_kunden_projekte || CURRENT_USER.is_admin)) {
        const listEl = document.getElementById("project-list");
        const countEl = document.getElementById("project-count");
        const errEl = document.getElementById("project-error");
        if (errEl) errEl.textContent = "Keine Berechtigung für Projekte.";
        if (listEl) listEl.innerHTML = "";
        if (countEl) countEl.textContent = "";
        return;
    }

    const listEl = document.getElementById("project-list");
    const countEl = document.getElementById("project-count");
    const errEl = document.getElementById("project-error");
    if (!listEl || !countEl || !errEl) return;

    errEl.textContent = "";
    listEl.innerHTML = "<div class='small'>Lade Projekte…</div>";

    try {
        const resp = await fetch(`${API_BASE}/projects/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        PROJECTS_CACHE = data;

        countEl.textContent = `${data.length} Projekt(e)`;
        if (data.length === 0) {
            listEl.innerHTML = "<div class='small'>Noch keine Projekte angelegt.</div>";
            return;
        }

        listEl.innerHTML = "";
        data.forEach((p) => {
            const div = document.createElement("div");
            div.className = "item";

            const title = document.createElement("div");
            title.className = "item-title";

            const left = document.createElement("span");
            left.innerHTML = `
                ${p.titel}
                <span class="small">#${p.id}</span>
                <span class="status">${p.status}</span>
            `;

            const right = document.createElement("span");
            if (CURRENT_USER.is_admin) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "Löschen";
                delBtn.className = "btn-danger";
                delBtn.addEventListener("click", async () => {
                    if (!confirm(`Projekt "${p.titel}" (#${p.id}) wirklich löschen?`)) return;
                    try {
                        const resp = await fetch(`${API_BASE}/projects/${p.id}`, {
                            method: "DELETE",
                        });
                        if (!resp.ok) {
                            const txt = await resp.text();
                            throw new Error(`Status ${resp.status}: ${txt}`);
                        }
                        await loadProjects();
                        await reloadProjectsForTimeSelect();
                    } catch (err) {
                        alert("Fehler beim Löschen des Projekts: " + err);
                    }
                });
                right.appendChild(delBtn);
            }

            title.appendChild(left);
            title.appendChild(right);

            const sub = document.createElement("div");
            sub.className = "item-sub";
            sub.textContent = `Kunde: ${p.customer_firma || "ID " + p.customer_id}${p.projektpfad ? " · " + p.projektpfad : ""}`;

            div.appendChild(title);
            div.appendChild(sub);
            listEl.appendChild(div);
        });

        await reloadProjectsForTimeSelect();
    } catch (err) {
        errEl.textContent = `Fehler beim Laden der Projekte: ${err}`;
        listEl.innerHTML = "";
        countEl.textContent = "";
    }
}

async function createProject() {
    if (!CURRENT_USER.can_manage_projects && !CURRENT_USER.is_admin) {
        const errEl = document.getElementById("project-error");
        if (errEl) errEl.textContent = "Keine Berechtigung, Projekte anzulegen.";
        return;
    }
    const cidEl = document.getElementById("project-customer-id");
    const titleEl = document.getElementById("project-title");
    const statusEl = document.getElementById("project-status");
    const errEl = document.getElementById("project-error");
    if (!cidEl || !titleEl || !statusEl || !errEl) return;

    errEl.textContent = "";

    const cidStr = cidEl.value.trim();
    const title = titleEl.value.trim();
    const status = statusEl.value || "Offen";

    if (!cidStr || !title) {
        errEl.textContent = "Kunden-ID und Projekttitel sind Pflicht.";
        return;
    }

    const cid = parseInt(cidStr, 10);
    if (isNaN(cid)) {
        errEl.textContent = "Kunden-ID muss eine Zahl sein.";
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/projects/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer_id: cid,
                titel: title,
                beschreibung: null,
                ist_offerte: status === "Offeriert",
                stundensatz: null,
                status: status,
            }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }
        cidEl.value = "";
        titleEl.value = "";
        await loadProjects();
    } catch (err) {
        errEl.textContent = `Fehler beim Anlegen: ${err}`;
    }
}

// ============================================================
//  M I T A R B E I T E R   (für Zeit & Admin)
// ============================================================

async function loadEmployeesForTime() {
    const select = document.getElementById("time-employee");
    if (!select) return;
    select.innerHTML = `<option value="">Mitarbeiter wählen…</option>`;

    try {
        const resp = await fetch(`${API_BASE}/employees/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        data.forEach((e) => {
            const opt = document.createElement("option");
            opt.value = e.id;
            opt.textContent = `${e.name} (${e.kuerzel || "ohne Kürzel"})`;
            select.appendChild(opt);
        });

        // Standard: aktueller User
        if (CURRENT_USER.id) {
            select.value = String(CURRENT_USER.id);
        }

        // Laufenden Eintrag aus DB wiederherstellen
        await restoreRunningEntry();
    } catch (err) {
        console.warn("Fehler beim Laden der Mitarbeiter:", err);
    }
}

// ============================================================
//  P R O J E K T E   für Live-Stempeln
// ============================================================

async function reloadProjectsForTimeSelect() {
    const select = document.getElementById("time-project-select");
    if (!select) return;

    if (!PROJECTS_CACHE || PROJECTS_CACHE.length === 0) {
        try {
            const resp = await fetch(`${API_BASE}/projects/`);
            if (!resp.ok) throw new Error(`Status ${resp.status}`);
            PROJECTS_CACHE = await resp.json();
        } catch (err) {
            console.warn("Fehler beim Nachladen der Projekte (Time-Select):", err);
            return;
        }
    }

    select.innerHTML = `<option value="">Projekt wählen…</option>`;
    PROJECTS_CACHE.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.titel} (#${p.id})`;
        select.appendChild(opt);
    });
}

// ============================================================
//  L I V E - S T E M P E L N
// ============================================================

function updateRunningUI(entry) {
    const infoEl = document.getElementById("time-running-info");
    if (!infoEl) return;

    if (!entry) {
        CURRENT_RUNNING_ENTRY = null;
        infoEl.textContent = "Kein laufender Eintrag.";
        return;
    }

    CURRENT_RUNNING_ENTRY = {
        id: entry.id,
        startTimeStr: entry.start ? formatTimeStr(entry.start) : "",
        dateStr: entry.datum,
        project_id: entry.project_id,
        activity: entry.taetigkeit,
        is_pause: entry.taetigkeit === "Pause",
    };

    const proj = PROJECTS_CACHE.find((p) => p.id === entry.project_id);
    const projText = proj ? `${proj.titel} (#${proj.id})` : "ohne Projekt";
    const act = entry.taetigkeit || "-";
    const startStr = entry.start ? formatTimeStr(entry.start) : "-";

    infoEl.textContent = `Laufend seit ${startStr}, Tätigkeit: ${act}, Projekt: ${projText}`;
}

async function fetchRunningEntry(employeeId) {
    if (!employeeId) {
        updateRunningUI(null);
        return;
    }
    try {
        const resp = await fetch(`${API_BASE}/timeentries/running?employee_id=${employeeId}`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json(); // kann null sein
        if (!data) {
            updateRunningUI(null);
            return;
        }
        updateRunningUI(data);
    } catch (err) {
        console.warn("Fehler beim Abfragen des laufenden Eintrags:", err);
        updateRunningUI(null);
    }
}

async function restoreRunningEntry() {
    const sel = document.getElementById("time-employee");
    if (!sel || !sel.value) {
        updateRunningUI(null);
        return;
    }
    await fetchRunningEntry(sel.value);
}

function getNowTimeStr() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}:00`;
}

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

async function startTimeTracking() {
    const errEl = document.getElementById("time-error");
    if (errEl) errEl.textContent = "";

    const empSelect = document.getElementById("time-employee");
    const actSelect = document.getElementById("time-activity");
    const dateEl = document.getElementById("time-date");
    const startEl = document.getElementById("time-start");
    const projSelect = document.getElementById("time-project-select");
    const commentEl = document.getElementById("time-comment");

    if (!empSelect || !actSelect || !dateEl || !startEl || !projSelect || !commentEl) return;

    const empId = empSelect.value;
    if (!empId) {
        if (errEl) errEl.textContent = "Bitte zuerst einen Mitarbeiter wählen.";
        return;
    }

    // Check ob schon etwas läuft
    if (CURRENT_RUNNING_ENTRY) {
        if (errEl) errEl.textContent = "Es läuft bereits ein Eintrag – zuerst stoppen oder pausieren.";
        return;
    }

    let dateStr = dateEl.value || getTodayStr();
    let startStr = startEl.value ? `${startEl.value}:00` : getNowTimeStr();

    const projectIdStr = projSelect.value;
    let projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;
    if (isNaN(projectId)) projectId = null;

    let customerId = null;
    if (projectId && PROJECTS_CACHE) {
        const p = PROJECTS_CACHE.find((x) => x.id === projectId);
        if (p) customerId = p.customer_id;
    }

    const activity = actSelect.value || null;
    const comment = commentEl.value || null;

    try {
        const resp = await fetch(`${API_BASE}/timeentries/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: parseInt(empId, 10),
                customer_id: customerId,
                project_id: projectId,
                datum: dateStr,
                start: startStr,
                ende: null,
                pause_min: null,
                dauer_stunden: null,
                taetigkeit: activity,
                details: comment,
                betrag: null,
                quelle_datei: null,
                externe_id: null,
                quelle_system: "web-ui",
            }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }
        const data = await resp.json();
        updateRunningUI(data);
        if (errEl) errEl.textContent = "";
    } catch (err) {
        if (errEl) errEl.textContent = `Fehler beim Starten: ${err}`;
    }
}

// Pause-Logik:
// - Wenn aktuell Arbeit läuft → Arbeit mit Ende=jetzt beenden, neue Pause starten.
// - Wenn aktuell Pause läuft → Pause mit Ende=jetzt beenden.
// - Immer nur EIN offener Eintrag pro Mitarbeiter.
async function pauseTimeTracking() {
    const errEl = document.getElementById("time-error");
    if (errEl) errEl.textContent = "";

    const empSelect = document.getElementById("time-employee");
    if (!empSelect || !empSelect.value) {
        if (errEl) errEl.textContent = "Bitte zuerst einen Mitarbeiter wählen.";
        return;
    }
    const empId = empSelect.value;

    // Immer erst frische Info aus Backend holen
    await fetchRunningEntry(empId);

    const nowStr = getNowTimeStr();

    try {
        if (!CURRENT_RUNNING_ENTRY) {
            // Keine Arbeit läuft → reine Pause starten
            const today = getTodayStr();
            const resp = await fetch(`${API_BASE}/timeentries/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employee_id: parseInt(empId, 10),
                    customer_id: null,
                    project_id: null,
                    datum: today,
                    start: nowStr,
                    ende: null,
                    pause_min: null,
                    dauer_stunden: null,
                    taetigkeit: "Pause",
                    details: null,
                    betrag: null,
                    quelle_datei: null,
                    externe_id: null,
                    quelle_system: "web-ui",
                }),
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Status ${resp.status}: ${txt}`);
            }
            const data = await resp.json();
            updateRunningUI(data);
            return;
        }

        // Es läuft etwas
        if (CURRENT_RUNNING_ENTRY.is_pause) {
            // Pause beenden
            const resp = await fetch(`${API_BASE}/timeentries/${CURRENT_RUNNING_ENTRY.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ende: nowStr,
                }),
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Status ${resp.status}: ${txt}`);
            }
            updateRunningUI(null);
        } else {
            // Arbeit läuft → Arbeit beenden, neue Pause starten
            // 1. Arbeit beenden
            let resp = await fetch(`${API_BASE}/timeentries/${CURRENT_RUNNING_ENTRY.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ende: nowStr,
                }),
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Status ${resp.status}: ${txt}`);
            }

            // 2. Pause starten
            const today = getTodayStr();
            resp = await fetch(`${API_BASE}/timeentries/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employee_id: parseInt(empId, 10),
                    customer_id: null,
                    project_id: null,
                    datum: today,
                    start: nowStr,
                    ende: null,
                    pause_min: null,
                    dauer_stunden: null,
                    taetigkeit: "Pause",
                    details: null,
                    betrag: null,
                    quelle_datei: null,
                    externe_id: null,
                    quelle_system: "web-ui",
                }),
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Status ${resp.status}: ${txt}`);
            }
            const pauseEntry = await resp.json();
            updateRunningUI(pauseEntry);
        }
    } catch (err) {
        if (errEl) errEl.textContent = `Fehler bei Pause: ${err}`;
    }
}

async function stopTimeTracking() {
    const errEl = document.getElementById("time-error");
    if (errEl) errEl.textContent = "";

    const empSelect = document.getElementById("time-employee");
    if (!empSelect || !empSelect.value) {
        if (errEl) errEl.textContent = "Bitte zuerst einen Mitarbeiter wählen.";
        return;
    }
    const empId = empSelect.value;

    await fetchRunningEntry(empId);
    if (!CURRENT_RUNNING_ENTRY) {
        if (errEl) errEl.textContent = "Kein laufender Eintrag zum Stoppen.";
        return;
    }

    const nowStr = getNowTimeStr();

    try {
        const resp = await fetch(`${API_BASE}/timeentries/${CURRENT_RUNNING_ENTRY.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ende: nowStr,
            }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }
        updateRunningUI(null);
        await loadTimeEntries();
    } catch (err) {
        if (errEl) errEl.textContent = `Fehler beim Stoppen: ${err}`;
    }
}

// ============================================================
//  Z E I T E I N T R Ä G E  &  A U S W E R T U N G
// ============================================================

function getRangeForViewMode(mode, baseDateStr) {
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();

    function fmt(dt) {
        return dt.toISOString().slice(0, 10);
    }

    if (mode === "week") {
        const day = base.getDay(); // 0=So..6=Sa
        const diffToMonday = (day + 6) % 7;
        const monday = new Date(base);
        monday.setDate(d - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: fmt(monday), to: fmt(sunday) };
    } else if (mode === "month") {
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        return { from: fmt(first), to: fmt(last) };
    } else if (mode === "year") {
        const first = new Date(y, 0, 1);
        const last = new Date(y, 11, 31);
        return { from: fmt(first), to: fmt(last) };
    } else {
        // day
        const dt = new Date(y, m, d);
        return { from: fmt(dt), to: fmt(dt) };
    }
}

function renderTimePieChart(totalsByActivity) {
    const canvas = document.getElementById("time-pie-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const entries = Object.entries(totalsByActivity).filter(([, v]) => v > 0);
    if (entries.length === 0) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "12px system-ui";
        ctx.fillText("Keine Daten für ausgewählten Zeitraum.", 10, 20);
        return;
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    let startAngle = -Math.PI / 2;

    entries.forEach(([label, val], idx) => {
        const fraction = val / total;
        const endAngle = startAngle + fraction * 2 * Math.PI;

        // einfache Farbgenerierung
        const hue = (idx * 60) % 360;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fill();

        startAngle = endAngle;
    });

    // Legende
    ctx.font = "11px system-ui";
    let legendY = 14;
    entries.forEach(([label, val], idx) => {
        const hue = (idx * 60) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(10, legendY - 8, 10, 10);
        ctx.fillStyle = "#e5e7eb";
        const pct = ((val / total) * 100).toFixed(1);
        ctx.fillText(`${label} (${val.toFixed(2)} h, ${pct}%)`, 25, legendY);
        legendY += 14;
    });
}

async function loadTimeEntries() {
    const listEl = document.getElementById("time-entry-list");
    const errEl = document.getElementById("time-error");
    const modeEl = document.getElementById("time-view-mode");
    const dateEl = document.getElementById("time-view-date");
    const empSelect = document.getElementById("time-employee");

    if (!listEl || !modeEl || !dateEl) return;
    if (errEl) errEl.textContent = "";

    listEl.innerHTML = "<div class='small'>Lade Zeiteinträge…</div>";

    const mode = modeEl.value || "day";
    const baseDateStr = dateEl.value || getTodayStr();
    const { from, to } = getRangeForViewMode(mode, baseDateStr);

    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (empSelect && empSelect.value) {
        params.set("employee_id", empSelect.value);
    }

    try {
        const resp = await fetch(`${API_BASE}/timeentries/?${params.toString()}`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        listEl.innerHTML = "";
        if (!data || data.length === 0) {
            listEl.innerHTML = "<div class='small'>Keine Einträge im gewählten Zeitraum.</div>";
            renderTimePieChart({});
            return;
        }

        const totalsByActivity = {};

        data.forEach((e) => {
            const div = document.createElement("div");
            div.className = "item";

            const title = document.createElement("div");
            title.className = "item-title";

            const left = document.createElement("span");
            const startStr = e.start ? formatTimeStr(e.start) : "";
            const endeStr = e.ende ? formatTimeStr(e.ende) : "";
            const act = e.taetigkeit || "-";
            left.textContent = `${e.datum} ${startStr}${endeStr ? " - " + endeStr : ""} · ${act}`;

            const right = document.createElement("span");
            if (CURRENT_USER.is_admin) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "Löschen";
                delBtn.className = "btn-danger";
                delBtn.addEventListener("click", async () => {
                    if (!confirm(`Eintrag #${e.id} wirklich löschen?`)) return;
                    try {
                        const resp = await fetch(`${API_BASE}/timeentries/${e.id}`, {
                            method: "DELETE",
                        });
                        if (!resp.ok) {
                            const txt = await resp.text();
                            throw new Error(`Status ${resp.status}: ${txt}`);
                        }
                        await loadTimeEntries();
                        await restoreRunningEntry();
                    } catch (err2) {
                        alert("Fehler beim Löschen des Eintrags: " + err2);
                    }
                });
                right.appendChild(delBtn);
            }

            title.appendChild(left);
            title.appendChild(right);

            const sub = document.createElement("div");
            sub.className = "item-sub";
            const projText = e.projektpfad ? e.projektpfad : (e.project_id ? "Projekt #" + e.project_id : "–");
            const custText = e.customer_firma || (e.customer_id ? "Kunde #" + e.customer_id : "–");
            const empText = e.employee_name || (e.employee_id ? "Mitarbeiter #" + e.employee_id : "–");

            sub.textContent = `Projekt: ${projText} · Kunde: ${custText} · Mitarbeiter: ${empText}${e.details ? " · " + e.details : ""}`;

            div.appendChild(title);
            div.appendChild(sub);
            listEl.appendChild(div);

            // Dauer aufsummieren
            let dur = e.dauer_stunden;
            if (dur == null) {
                if (e.start && e.ende) {
                    const sm = parseTimeToMinutes(formatTimeStr(e.start));
                    const em = parseTimeToMinutes(formatTimeStr(e.ende));
                    if (sm != null && em != null && em >= sm) {
                        dur = minutesToHours(em - sm);
                    }
                }
            }
            if (dur != null) {
                const key = act;
                totalsByActivity[key] = (totalsByActivity[key] || 0) + dur;
            }
        });

        renderTimePieChart(totalsByActivity);
    } catch (err) {
        if (errEl) errEl.textContent = `Fehler beim Laden der Zeiteinträge: ${err}`;
        listEl.innerHTML = "";
        renderTimePieChart({});
    }
}

// ============================================================
//  A D M I N  -  M I T A R B E I T E R
// ============================================================

function showEmployeeForm(show) {
    const el = document.getElementById("admin-employee-form");
    if (!el) return;
    el.style.display = show ? "block" : "none";
}

async function loadEmployeesAdmin() {
    const select = document.getElementById("admin-employee-select");
    if (!select) return;

    // Dropdown zurücksetzen
    select.innerHTML = `<option value="">Mitarbeiter wählen…</option>`;

    try {
        const resp = await fetch(`${API_BASE}/employees/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        EMPLOYEES_CACHE_ADMIN = data;

        if (!data || data.length === 0) {
            // keine Mitarbeiter → Formular zu
            showEmployeeForm(false);
            return;
        }

        data.forEach((e) => {
            const opt = document.createElement("option");
            opt.value = e.id;
            opt.textContent = `${e.name}${e.kuerzel ? " (" + e.kuerzel + ")" : ""}`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Fehler beim Laden der Mitarbeiter (Admin):", err);
        showEmployeeForm(false);
    }
}

function fillEmployeeAdminForm(e) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? "";
    };
    const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    document.getElementById("admin-employee-id").value = e.id;

    // Persönlich
    setVal("admin-employee-name", e.name);
    setVal("admin-employee-kuerzel", e.kuerzel);
    setVal("admin-employee-geburtsdatum", e.geburtsdatum);
    setVal("admin-employee-ahv", e.ahv_nummer);
    setVal("admin-employee-zivilstand", e.zivilstand);
    setVal("admin-employee-kinder", e.kinderanzahl);

    // Kontakt
    setVal("admin-employee-adresse", e.adresse);
    setVal("admin-employee-plz", e.plz);
    setVal("admin-employee-ort", e.ort);
    setVal("admin-employee-email", e.email);
    setVal("admin-employee-telefon", e.telefon);
    setVal("admin-employee-notfallkontakt", e.notfallkontakt);
    setVal("admin-employee-notfalltelefon", e.notfalltelefon);

    // Arbeitsvertrag
    setVal("admin-employee-eintritt", e.eintrittsdatum);
    setVal("admin-employee-austritt", e.austrittsdatum);
    setVal("admin-employee-pensum", e.pensum);
    setVal("admin-employee-stdwoche", e.stunden_pro_woche);
    setVal("admin-employee-lohnart", e.lohnart);
    setVal("admin-employee-lohn", e.lohn);

    setChecked("admin-employee-dreizehnter", e.dreizehnter);
    setChecked("admin-employee-kader", e.kadervertrag);

    // Ferien & Zeit
    setVal("admin-employee-ferienanspruch", e.ferienanspruch);
    setVal("admin-employee-ferien-guthaben", e.ferien_guthaben_stunden);
    setVal("admin-employee-ueberstunden", e.ueberstunden_guthaben);

    // Versicherungen
    setVal("admin-employee-bvg-eintritt", e.bvg_eintritt);
    setChecked("admin-employee-bvg-pflichtig", e.bvg_pflichtig);
    setChecked("admin-employee-ktg", e.krankentaggeld_versichert);
    setChecked("admin-employee-unfallpriv", e.unfallversicherung_priv);

    // Bank
    setVal("admin-employee-iban", e.iban);
    setVal("admin-employee-bank", e.bank);

    // Intern
    setVal("admin-employee-abteilung", e.abteilung);
    setVal("admin-employee-rolle", e.rolle);
    setVal("admin-employee-kostenstelle", e.kostenstelle);
    setVal("admin-employee-qualifikationen", e.qualifikationen);
    setVal("admin-employee-notizen", e.notizen_intern);

    // Sonstiges
    setVal("admin-employee-krankentage", e.krankentage);
    setChecked("admin-employee-aktiv", e.aktiv);

    // Rechte
    setChecked("admin-employee-is-admin", e.is_admin);
    setChecked("admin-employee-can-manage", e.can_manage_projects);
    setChecked("admin-employee-can-kp", e.can_see_customers_projects);
}

function newEmployeeAdminForm() {
    const ids = [
        "admin-employee-id",
        "admin-employee-name",
        "admin-employee-kuerzel",
        "admin-employee-geburtsdatum",
        "admin-employee-ahv",
        "admin-employee-zivilstand",
        "admin-employee-kinder",
        "admin-employee-adresse",
        "admin-employee-plz",
        "admin-employee-ort",
        "admin-employee-email",
        "admin-employee-telefon",
        "admin-employee-notfallkontakt",
        "admin-employee-notfalltelefon",
        "admin-employee-eintritt",
        "admin-employee-austritt",
        "admin-employee-pensum",
        "admin-employee-stdwoche",
        "admin-employee-lohnart",
        "admin-employee-lohn",
        "admin-employee-ferienanspruch",
        "admin-employee-ferien-guthaben",
        "admin-employee-ueberstunden",
        "admin-employee-bvg-eintritt",
        "admin-employee-iban",
        "admin-employee-bank",
        "admin-employee-abteilung",
        "admin-employee-rolle",
        "admin-employee-kostenstelle",
        "admin-employee-qualifikationen",
        "admin-employee-notizen",
        "admin-employee-krankentage",
    ];

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    [
        "admin-employee-dreizehnter",
        "admin-employee-kader",
        "admin-employee-bvg-pflichtig",
        "admin-employee-ktg",
        "admin-employee-unfallpriv",
        "admin-employee-is-admin",
        "admin-employee-can-manage",
        "admin-employee-can-kp",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    const aktiv = document.getElementById("admin-employee-aktiv");
    if (aktiv) aktiv.checked = true;

    showEmployeeForm(true);
}

async function saveEmployeeAdmin() {
    const idStr = document.getElementById("admin-employee-id").value;
    const name = document.getElementById("admin-employee-name").value.trim();
    if (!name) {
        alert("Name ist Pflicht.");
        return;
    }

    const payload = {
        name: name,
        kuerzel: document.getElementById("admin-employee-kuerzel").value || null,
        geburtsdatum: document.getElementById("admin-employee-geburtsdatum").value || null,
        ahv_nummer: document.getElementById("admin-employee-ahv").value || null,
        zivilstand: document.getElementById("admin-employee-zivilstand").value || null,
        kinderanzahl: document.getElementById("admin-employee-kinder").value
            ? parseInt(document.getElementById("admin-employee-kinder").value, 10)
            : null,
        adresse: document.getElementById("admin-employee-adresse").value || null,
        plz: document.getElementById("admin-employee-plz").value || null,
        ort: document.getElementById("admin-employee-ort").value || null,
        email: document.getElementById("admin-employee-email").value || null,
        telefon: document.getElementById("admin-employee-telefon").value || null,
        notfallkontakt: document.getElementById("admin-employee-notfallkontakt").value || null,
        notfalltelefon: document.getElementById("admin-employee-notfalltelefon").value || null,
        eintrittsdatum: document.getElementById("admin-employee-eintritt").value || null,
        austrittsdatum: document.getElementById("admin-employee-austritt").value || null,
        pensum: document.getElementById("admin-employee-pensum").value
            ? parseFloat(document.getElementById("admin-employee-pensum").value)
            : null,
        stunden_pro_woche: document.getElementById("admin-employee-stdwoche").value
            ? parseFloat(document.getElementById("admin-employee-stdwoche").value)
            : null,
        lohnart: document.getElementById("admin-employee-lohnart").value || null,
        lohn: document.getElementById("admin-employee-lohn").value
            ? parseFloat(document.getElementById("admin-employee-lohn").value)
            : null,
        dreizehnter: document.getElementById("admin-employee-dreizehnter").checked,
        kadervertrag: document.getElementById("admin-employee-kader").checked,
        ferienanspruch: document.getElementById("admin-employee-ferienanspruch").value
            ? parseFloat(document.getElementById("admin-employee-ferienanspruch").value)
            : null,
        ferien_guthaben_stunden: document.getElementById("admin-employee-ferien-guthaben").value
            ? parseFloat(document.getElementById("admin-employee-ferien-guthaben").value)
            : null,
        ueberstunden_guthaben: document.getElementById("admin-employee-ueberstunden").value
            ? parseFloat(document.getElementById("admin-employee-ueberstunden").value)
            : null,
        bvg_eintritt: document.getElementById("admin-employee-bvg-eintritt").value || null,
        bvg_pflichtig: document.getElementById("admin-employee-bvg-pflichtig").checked,
        krankentaggeld_versichert: document.getElementById("admin-employee-ktg").checked,
        unfallversicherung_priv: document.getElementById("admin-employee-unfallpriv").checked,
        iban: document.getElementById("admin-employee-iban").value || null,
        bank: document.getElementById("admin-employee-bank").value || null,
        abteilung: document.getElementById("admin-employee-abteilung").value || null,
        rolle: document.getElementById("admin-employee-rolle").value || null,
        kostenstelle: document.getElementById("admin-employee-kostenstelle").value || null,
        qualifikationen: document.getElementById("admin-employee-qualifikationen").value || null,
        notizen_intern: document.getElementById("admin-employee-notizen").value || null,
        krankentage: document.getElementById("admin-employee-krankentage").value
            ? parseFloat(document.getElementById("admin-employee-krankentage").value)
            : null,
        aktiv: document.getElementById("admin-employee-aktiv").checked,
        is_admin: document.getElementById("admin-employee-is-admin").checked,
        can_manage_projects: document.getElementById("admin-employee-can-manage").checked,
        can_see_customers_projects: document.getElementById("admin-employee-can-kp").checked,
    };

    const isNew = !idStr;
    const method = isNew ? "POST" : "PUT";
    const url = isNew
        ? `${API_BASE}/employees/`
        : `${API_BASE}/employees/${parseInt(idStr, 10)}`;

    try {
        const resp = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }

        await loadEmployeesAdmin();
        showEmployeeForm(false);
        alert("Mitarbeiter gespeichert.");
    } catch (err) {
        alert("Fehler beim Speichern des Mitarbeiters: " + err);
    }
}

// ============================================================
//  A D M I N  -  T Ä T I G K E I T E N  (Platzhalter)
// ============================================================

async function loadActivitiesAdmin() {
    const listEl = document.getElementById("admin-activity-list");
    if (!listEl) return;
    listEl.innerHTML =
        "<div class='small'>Tätigkeiten-Verwaltung: Backend-Endpoint /activities ist noch nicht implementiert.</div>";
}

async function createActivityAdmin() {
    alert("Tätigkeiten-Verwaltung im Backend (/activities) ist noch nicht implementiert.");
}

// ============================================================
//  T A B S   &   I N I T
// ============================================================

function initTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    const contents = {
        kp: document.getElementById("tab-kp"),
        time: document.getElementById("tab-time"),
        admin: document.getElementById("tab-admin"),
    };

    updateTabVisibility();

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");

            if (tab === "admin" && !CURRENT_USER.is_admin) {
                alert("Kein Zugriff auf den Admin-Bereich.");
                return;
            }
            if (tab === "kp" && !(CURRENT_USER.can_see_kunden_projekte || CURRENT_USER.is_admin)) {
                alert("Kein Zugriff auf Kunden und Projekte.");
                return;
            }

            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            Object.keys(contents).forEach((key) => {
                if (!contents[key]) return;
                contents[key].classList.toggle("active", key === tab);
            });

            if (tab === "time") {
                loadEmployeesForTime();
                reloadProjectsForTimeSelect();
                loadTimeEntries();
                setTodayAsDefaultDate();
            }
            if (tab === "kp") {
                loadCustomers();
                loadProjects();
            }
            if (tab === "admin") {
                loadEmployeesAdmin();
                loadActivitiesAdmin();
                showEmployeeForm(false);
            }
        });
    });

    // Subtabs im Zeit-Tab
    const subBtns = document.querySelectorAll(".subtab-btn");
    const subContents = {
        live: document.getElementById("time-sub-live"),
        entries: document.getElementById("time-sub-entries"),
    };

    subBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const st = btn.getAttribute("data-subtab");
            subBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            Object.keys(subContents).forEach((key) => {
                if (!subContents[key]) return;
                subContents[key].classList.toggle("active", key === st);
            });

            if (st === "entries") {
                loadTimeEntries();
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initTabs();

    // Buttons verbinden
    document.getElementById("btn-create-customer")?.addEventListener("click", createCustomer);
    document.getElementById("btn-reload-customers")?.addEventListener("click", loadCustomers);

    document.getElementById("btn-create-project")?.addEventListener("click", createProject);
    document.getElementById("btn-reload-projects")?.addEventListener("click", loadProjects);

    // Live-Stempeln
    document.getElementById("btn-time-start")?.addEventListener("click", startTimeTracking);
    document.getElementById("btn-time-pause")?.addEventListener("click", pauseTimeTracking);
    document.getElementById("btn-time-stop")?.addEventListener("click", stopTimeTracking);

    // Admin
    document.getElementById("btn-admin-employee-save")?.addEventListener("click", saveEmployeeAdmin);
    document.getElementById("btn-admin-employee-new")?.addEventListener("click", newEmployeeAdminForm);
    document.getElementById("btn-admin-activity-add")?.addEventListener("click", createActivityAdmin);
    document.getElementById("admin-employee-select")?.addEventListener("change", (ev) => {
        const idStr = ev.target.value;
        if (!idStr) {
            showEmployeeForm(false);
            return;
        }
        const id = parseInt(idStr, 10);
        const emp = (EMPLOYEES_CACHE_ADMIN || []).find((e) => e.id === id);
        if (emp) {
            fillEmployeeAdminForm(emp);
            showEmployeeForm(true);
        }
    });

    // Zeit-Auswertung: neu laden bei Modus/Datum-Änderung
    document.getElementById("time-view-mode")?.addEventListener("change", loadTimeEntries);
    document.getElementById("time-view-date")?.addEventListener("change", loadTimeEntries);

    // Anfangszustand
    checkBackend();
    loadCustomers();
    loadProjects();
    setTodayAsDefaultDate();
    loadEmployeesForTime();

    // Admin-Formular standardmässig eingeklappt
    showEmployeeForm(false);
});
