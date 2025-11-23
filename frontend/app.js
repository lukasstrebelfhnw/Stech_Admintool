const API_BASE = "http://192.168.178.83:8000";

let PROJECTS_CACHE = [];

// -------- Backend-Status --------

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

// -------- Kunden --------

async function loadCustomers() {
    const listEl = document.getElementById("customer-list");
    const countEl = document.getElementById("customer-count");
    const errEl = document.getElementById("customer-error");

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
            div.innerHTML = `
        <div class="item-title">${c.firma} <span class="small">#${c.id}</span></div>
        <div class="item-sub">
          ${c.kontaktperson || "-"}
          ${c.ort ? " · " + c.ort : ""}
          ${c.email ? " · " + c.email : ""}
        </div>
      `;
            listEl.appendChild(div);
        });
    } catch (err) {
        errEl.textContent = `Fehler beim Laden der Kunden: ${err}`;
        listEl.innerHTML = "";
        countEl.textContent = "";
    }
}

async function createCustomer() {
    const firmaEl = document.getElementById("customer-firma");
    const kontaktEl = document.getElementById("customer-kontakt");
    const errEl = document.getElementById("customer-error");
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
                firma: firma,
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

// -------- Projekte --------

async function loadProjects() {
    const listEl = document.getElementById("project-list");
    const countEl = document.getElementById("project-count");
    const errEl = document.getElementById("project-error");
    errEl.textContent = "";
    listEl.innerHTML = "<div class='small'>Lade Projekte…</div>";

    try {
        const resp = await fetch(`${API_BASE}/projects/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        PROJECTS_CACHE = data; // global für Zeiterfassung

        countEl.textContent = `${data.length} Projekt(e)`;
        if (data.length === 0) {
            listEl.innerHTML = "<div class='small'>Noch keine Projekte angelegt.</div>";
            return;
        }

        listEl.innerHTML = "";
        data.forEach((p) => {
            const div = document.createElement("div");
            div.className = "item";
            div.innerHTML = `
        <div class="item-title">
          ${p.titel}
          <span class="small">#${p.id}</span>
          <span class="status">${p.status}</span>
        </div>
        <div class="item-sub">
          Kunde: ${p.customer_firma || ("ID " + p.customer_id)}
          ${p.projektpfad ? " · " + p.projektpfad : ""}
        </div>
      `;
            listEl.appendChild(div);
        });
    } catch (err) {
        errEl.textContent = `Fehler beim Laden der Projekte: ${err}`;
        listEl.innerHTML = "";
        countEl.textContent = "";
    }
}

async function createProject() {
    const cidEl = document.getElementById("project-customer-id");
    const titleEl = document.getElementById("project-title");
    const errEl = document.getElementById("project-error");
    errEl.textContent = "";

    const cidStr = cidEl.value.trim();
    const title = titleEl.value.trim();

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
                ist_offerte: false,
                stundensatz: null,
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

// -------- Employees für Zeiterfassung --------

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
    } catch (err) {
        // Kein harter Fehler, falls employees-Endpoint noch nicht fertig
        console.warn("Fehler beim Laden der Mitarbeiter:", err);
    }
}

// -------- Zeiterfassung: Projekt-Schnellsuche --------

function renderProjectSearchResults(filterText) {
    const listEl = document.getElementById("time-project-search-results");
    listEl.innerHTML = "";

    const text = (filterText || "").toLowerCase();
    if (!text) {
        listEl.innerHTML = "<div class='small'>Tippe, um nach Projekten zu suchen…</div>";
        return;
    }

    const matches = PROJECTS_CACHE.filter((p) => {
        const title = (p.titel || "").toLowerCase();
        const kunde = (p.customer_firma || "").toLowerCase();
        return title.includes(text) || kunde.includes(text);
    }).slice(0, 30);

    if (matches.length === 0) {
        listEl.innerHTML = "<div class='small'>Keine passenden Projekte gefunden.</div>";
        return;
    }

    matches.forEach((p) => {
        const div = document.createElement("div");
        div.className = "item";
        div.style.cursor = "pointer";
        div.innerHTML = `
      <div class="item-title">
        ${p.titel}
        <span class="small">#${p.id}</span>
        <span class="badge">${p.customer_firma || "Kunde ID " + p.customer_id}</span>
      </div>
      <div class="item-sub">
        ${p.projektpfad || ""}
      </div>
    `;
        div.addEventListener("click", () => {
            // Projekt/Kunde ins Formular schreiben
            const projIdEl = document.getElementById("time-project-id");
            const custIdEl = document.getElementById("time-customer-id");
            if (projIdEl) projIdEl.value = p.id;
            if (custIdEl && p.customer_id) custIdEl.value = p.customer_id;

            const searchInput = document.getElementById("time-project-search");
            if (searchInput) searchInput.value = p.titel;

            listEl.innerHTML = `<div class='small'>Ausgewählt: ${p.titel} (#${p.id})</div>`;
        });
        listEl.appendChild(div);
    });
}

async function reloadProjectsForSearch() {
    try {
        const resp = await fetch(`${API_BASE}/projects/`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        PROJECTS_CACHE = await resp.json();
        const searchInput = document.getElementById("time-project-search");
        renderProjectSearchResults(searchInput?.value || "");
    } catch (err) {
        const listEl = document.getElementById("time-project-search-results");
        listEl.innerHTML = `<div class="small">Fehler beim Laden der Projekte: ${err}</div>`;
    }
}

// -------- Zeiterfassung: TimeEntries --------

async function createTimeEntryFromForm() {
    const errEl = document.getElementById("time-error");
    errEl.textContent = "";

    const empSel = document.getElementById("time-employee");
    const activitySel = document.getElementById("time-activity");

    const dateEl = document.getElementById("time-date");
    const startEl = document.getElementById("time-start");
    const endEl = document.getElementById("time-end");
    const pauseEl = document.getElementById("time-pause");
    const hoursEl = document.getElementById("time-hours");

    const projIdEl = document.getElementById("time-project-id");
    const custIdEl = document.getElementById("time-customer-id");
    const commentEl = document.getElementById("time-comment");

    const employeeId = parseInt(empSel.value, 10);
    if (isNaN(employeeId)) {
        errEl.textContent = "Bitte einen Mitarbeiter wählen.";
        return;
    }

    const datum = dateEl.value;
    if (!datum) {
        errEl.textContent = "Bitte ein Datum wählen.";
        return;
    }

    const dauerStr = hoursEl.value.trim();
    let dauer = dauerStr ? parseFloat(dauerStr.replace(",", ".")) : NaN;
    if (isNaN(dauer)) {
        errEl.textContent = "Bitte Dauer [h] eintragen (z.B. 8.5).";
        return;
    }

    const pauseMin = pauseEl.value ? parseInt(pauseEl.value, 10) : null;
    const projectId = projIdEl.value ? parseInt(projIdEl.value, 10) : null;
    const customerId = custIdEl.value ? parseInt(custIdEl.value, 10) : null;

    const payload = {
        employee_id: employeeId,
        customer_id: customerId,
        project_id: projectId,
        datum: datum,
        start: startEl.value || null,
        ende: endEl.value || null,
        pause_min: pauseMin,
        dauer_stunden: dauer,
        taetigkeit: activitySel.value || null,
        details: commentEl.value || null,
        betrag: null,
        quelle_datei: null,
        externe_id: null,
        quelle_system: "app",
    };

    try {
        const resp = await fetch(`${API_BASE}/timeentries/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Status ${resp.status}: ${txt}`);
        }

        // Formular leeren
        // (Mitarbeiter & Tätigkeit lassen wir stehen)
        dateEl.value = "";
        startEl.value = "";
        endEl.value = "";
        pauseEl.value = "";
        hoursEl.value = "";
        projIdEl.value = "";
        custIdEl.value = "";
        commentEl.value = "";

        await loadTimeEntries();
    } catch (err) {
        errEl.textContent = `Fehler beim Speichern: ${err}`;
    }
}

async function loadTimeEntries() {
    const listEl = document.getElementById("time-entry-list");
    const errEl = document.getElementById("time-error");
    const empSel = document.getElementById("time-employee");

    errEl.textContent = "";
    listEl.innerHTML = "<div class='small'>Lade Zeit-Einträge…</div>";

    let url = `${API_BASE}/timeentries/`;
    if (empSel && empSel.value) {
        url += `?employee_id=${empSel.value}`;
    }

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();

        if (data.length === 0) {
            listEl.innerHTML = "<div class='small'>Noch keine Zeit-Einträge vorhanden.</div>";
            return;
        }

        // sortiere nach Datum absteigend
        data.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));

        listEl.innerHTML = "";
        data.slice(0, 50).forEach((e) => {
            const div = document.createElement("div");
            div.className = "item";
            const datum = e.datum;
            const dauer = e.dauer_stunden?.toFixed?.(2) ?? e.dauer_stunden;
            div.innerHTML = `
        <div class="item-title">
          ${datum} – ${e.taetigkeit || "ohne Tätigkeit"}
          <span class="badge">${dauer} h</span>
        </div>
        <div class="item-sub">
          MA: ${e.employee_name || ("ID " + e.employee_id)} ·
          Kunde: ${e.customer_firma || (e.customer_id ? "ID " + e.customer_id : "–")} ·
          Projekt: ${e.project_id || "–"}
          ${e.projektpfad ? " · " + e.projektpfad : ""}
          ${e.details ? " · " + e.details : ""}
        </div>
      `;
            listEl.appendChild(div);
        });
    } catch (err) {
        errEl.textContent = `Fehler beim Laden der Zeit-Einträge: ${err}`;
        listEl.innerHTML = "";
    }
}

// -------- CSV-Import im Browser (→ POST /timeentries/) --------

async function importCsvFile() {
    const fileInput = document.getElementById("time-csv-file");
    const errEl = document.getElementById("time-csv-error");
    errEl.textContent = "";

    if (!fileInput.files || fileInput.files.length === 0) {
        errEl.textContent = "Bitte zuerst eine CSV-Datei wählen.";
        return;
    }

    const file = fileInput.files[0];
    let text;
    try {
        text = await file.text();
    } catch (err) {
        errEl.textContent = `Fehler beim Lesen der Datei: ${err}`;
        return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
        errEl.textContent = "CSV scheint keine Datenzeilen zu enthalten.";
        return;
    }

    // Delimiter erkennen (; oder ,)
    const delimiter = lines[0].includes(";") ? ";" : ",";

    const header = lines[0].split(delimiter).map((h) => h.trim());

    // HIER Mapping an deine bestehende CSV anpassen!
    // Beispiel-Annahme:
    //   datum; start; ende; pause_min; dauer_stunden; employee_id; customer_id; project_id; taetigkeit; details
    const colIndex = {
        datum: header.indexOf("datum"),
        start: header.indexOf("start"),
        ende: header.indexOf("ende"),
        pause_min: header.indexOf("pause_min"),
        dauer_stunden: header.indexOf("dauer_stunden"),
        employee_id: header.indexOf("employee_id"),
        customer_id: header.indexOf("customer_id"),
        project_id: header.indexOf("project_id"),
        taetigkeit: header.indexOf("taetigkeit"),
        details: header.indexOf("details"),
    };

    // Falls deine CSV andere Spaltennamen hat, oben anpassen
    // oder hier direkt mit fixen Spaltennummern arbeiten:
    //   z.B. const colIndex = { datum: 0, start: 1, ... };

    let imported = 0;
    let failed = 0;

    for (let i = 1; i < lines.length; i++) {
        const raw = lines[i];
        const parts = raw.split(delimiter);

        const get = (name) => {
            const idx = colIndex[name];
            if (idx === -1 || idx == null) return "";
            return (parts[idx] || "").trim();
        };

        const datum = get("datum");
        if (!datum) {
            // Zeile überspringen
            failed++;
            continue;
        }

        const employeeIdStr = get("employee_id");
        const employeeId = parseInt(employeeIdStr || "1", 10); // Default 1, falls keine Spalte
        if (isNaN(employeeId)) {
            failed++;
            continue;
        }

        const dauerStr = get("dauer_stunden");
        const dauer = parseFloat((dauerStr || "0").replace(",", "."));
        if (!dauer || isNaN(dauer)) {
            failed++;
            continue;
        }

        const payload = {
            employee_id: employeeId,
            customer_id: parseInt(get("customer_id") || "0", 10) || null,
            project_id: parseInt(get("project_id") || "0", 10) || null,
            datum: datum, // z.B. "2025-11-23" – evtl. Format in Backend/Mapping anpassen
            start: get("start") || null,
            ende: get("ende") || null,
            pause_min: parseInt(get("pause_min") || "0", 10) || null,
            dauer_stunden: dauer,
            taetigkeit: get("taetigkeit") || null,
            details: get("details") || raw, // Fallback: ganze Zeile
            betrag: null,
            quelle_datei: file.name,
            externe_id: null,
            quelle_system: "csv",
        };

        try {
            const resp = await fetch(`${API_BASE}/timeentries/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                failed++;
                continue;
            }
            imported++;
        } catch (_) {
            failed++;
        }
    }

    errEl.textContent = `CSV-Import abgeschlossen: ${imported} Einträge importiert, ${failed} Fehler.`;
    await loadTimeEntries();
}

// -------- Tabs --------

function initTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    const contents = {
        kp: document.getElementById("tab-kp"),
        time: document.getElementById("tab-time"),
    };

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");

            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            Object.keys(contents).forEach((key) => {
                contents[key].classList.toggle("active", key === tab);
            });

            // Beim Wechsel zum Zeit-Tab Daten nachladen
            if (tab === "time") {
                loadEmployeesForTime();
                reloadProjectsForSearch();
                loadTimeEntries();
            }
        });
    });
}

// -------- Init --------

document.addEventListener("DOMContentLoaded", () => {
    // Tabs
    initTabs();

    // Kunden & Projekte
    document
        .getElementById("btn-create-customer")
        .addEventListener("click", createCustomer);
    document
        .getElementById("btn-reload-customers")
        .addEventListener("click", loadCustomers);

    document
        .getElementById("btn-create-project")
        .addEventListener("click", createProject);
    document
        .getElementById("btn-reload-projects")
        .addEventListener("click", loadProjects);

    // Zeit-Tab
    document
        .getElementById("btn-create-timeentry")
        .addEventListener("click", createTimeEntryFromForm);
    document
        .getElementById("btn-reload-projects-time")
        .addEventListener("click", reloadProjectsForSearch);
    document
        .getElementById("btn-import-csv")
        .addEventListener("click", importCsvFile);

    const searchInput = document.getElementById("time-project-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) =>
            renderProjectSearchResults(e.target.value)
        );
    }

    // Initiale Loads
    checkBackend();
    loadCustomers();
    loadProjects();
});
