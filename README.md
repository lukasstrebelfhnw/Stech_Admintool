# STech Admin – Kunden-, Projekt- & Zeiterfassungsplattform

Ein vollständiges, containerisiertes Verwaltungssystem für **Kunden**, **Projekte**, **Mitarbeiter** und **Zeiteinträge**.  
Bestehend aus einem **FastAPI-Backend**, einem **Frontend ohne Framework**, sauber getrennten Modulen und optimiert für Docker‑Deployment.

---

# 📦 Projektstruktur

```
/backend
    main.py                → Haupt‑API mit FastAPI
    models.py              → SQLAlchemy ORM-Modelle
    schemas.py             → Pydantic-Schemas (Request/Response)
    db.py                  → DB-Verbindung & Session
/frontend
    index.html             → UI mit Tabs (Kunden, Projekte, Zeit, Admin)
    app.js                 → gesamte Client‑Logik (REST-Calls, UI-Logik)
    styles.css (optional)  → Style (derzeit inline)
docker-compose.yml         → Backend + Frontend + PostgreSQL
README.md                  → Dokumentation
```

---

# 🚀 Features

## **Kundenverwaltung**
✔ Kunde anlegen mit ausklappender Maske  
✔ Validierung: E-Mail **oder** Telefon Pflicht  
✔ Rechnungsadresse (optional, sonst Standardadresse)  
✔ Kundenliste & Löschen  
✔ Zähler & Fehlermeldungen

Pflichtfelder beim Anlegen:
- Firma  
- Kontaktperson **oder** Kontakt (E-Mail/Telefon)  
- Adresse, PLZ, Ort  
- Standard-Stundensatz  

---

## **Projektverwaltung**
✔ Projekt anlegen  
✔ Zuordnung zu einem Kunden  
✔ Status: *Offen, Offeriert, Abgeschlossen, Rechnung offen*  
✔ Projektliste + Löschen  

---

## **Zeiterfassung**
### Live-Stempeln
✔ Mitarbeiter wählen  
✔ Tätigkeit wählen  
✔ Projekt vorausgewählt beim Reload (per LocalStorage gespeichert)  
✔ Start / Pause / Stop  
✔ Laufender Eintrag wird automatisch wiederhergestellt nach Reload  
✔ Fehlerbehandlung & UI-Statusanzeige  
✔ Kommentar / Kurzbeschreibung

### Zeiteinträge
✔ Einträge sehen nach  
- Tag  
- Woche  
- Monat  
- Jahr  

✔ Bearbeiten möglich solange nicht **übermittelt**  
✔ „Offene Einträge übermitteln“ (Flag *uebermittelt*)  
✔ Löschen nur durch Admin  
✔ Dauerberechnung automatisch (Start–Ende)  
✔ Pro Projekt ein Canvas-Diagramm (Pie Chart)

---

## **Admin-Bereich**
✔ Mitarbeiter anlegen / bearbeiten  
✔ Über 40 Datenfelder (Kontakt, Vertrag, Versicherung etc.)  
✔ Rechteverwaltung:  
- Admin  
- Projekte verwalten  
- Kunden/Projekte sehen  

✔ Tätigkeiten-Verwaltung (Vorbereitung API-Endpunkte)

---

# 🧱 Backend (FastAPI)

- SQLAlchemy ORM  
- PostgreSQL  
- Pydantic v2  
- Automatische Tabellen­erstellung  
- Saubere Endpoints:
  - `/customers`
  - `/projects`
  - `/employees`
  - `/timeentries`
  - `/timeentries/running`
  - `/timeentries/submit_open`
- Cross-Origin freigeschaltet  
- Fehlerlogging im Docker‑Container

---

# 🖥️ Frontend

- Kein Framework  
- Nur **Vanilla JS**  
- Dynamisches UI  
- Subtabs für Zeiterfassung  
- Canvas-Piecharts pro Projekt  
- LocalStorage Speicherung:
  - Letztes Projekt
  - Letzte Tätigkeit

---

# 🐳 Docker Deployment

Im Projektverzeichnis:

```
docker compose up -d --build
```

Services:
- `stech_backend` (FastAPI, Port 8000)
- `stech_frontend` (NGINX, Port 8080)
- `stech_db` (PostgreSQL)

Logs anzeigen:

```
docker logs stech_backend --tail=200
```

Reset DB (z.B. bei Schemaänderungen):

```
sudo rm -rf db
docker compose down
docker compose up -d --build
```

---

# 🔒 Übermittelte Zeiteinträge

Nach Übermittlung:
- `uebermittelt = True`
- Eintrag ist **gesperrt** für normale User
- Nur Admin kann noch bearbeiten
- Zeitpunkt wird gespeichert: `uebermittelt_am`

---

# 🧪 Beispiel-Workflows

### **Kunde anlegen**
1. "Neuer Kunde" → Maske klappt auf  
2. Pflichtfelder ausfüllen  
3. Speichern  
4. Maske klappt wieder zu  
5. Kundenliste wird aktualisiert

### **Live-Stempeln**
1. Tätigkeit & Projekt setzen  
2. Start drücken  
3. Reload der Seite → laufender Eintrag bleibt  
4. Stop → Endzeit gesetzt  
5. Bearbeitung möglich bis Übermittlung

---

# 📝 ToDo & Roadmap

- Rechnungs- & PDF-Export  
- Mitarbeiterstundenreport  
- Projektstatistik über längere Zeiträume  
- Tätigkeiten im Backend speichern  
- Kunden-/Projekt-Suchfunktion  
- Mobile Oberfläche

---

# 💻 Entwicklung

### Backend Hot-Reload starten:
```
uvicorn main:app --reload
```

### Frontend testen:
Öffne:
```
http://localhost:8080
```

---

# 👤 Autor

**STech – Engineering & Automation**  
Entwicklung: Lukas Strebel

---

# 📄 Lizenz

MIT License  
Dieses Projekt darf frei genutzt und angepasst werden.

---

