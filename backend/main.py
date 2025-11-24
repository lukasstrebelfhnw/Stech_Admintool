# backend/main.py
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pathlib import Path
import shutil

from db import SessionLocal, engine, Base
import models
from schemas import (
    CustomerCreate, CustomerRead,
    ProjectCreate, ProjectRead,
    EmployeeCreate, EmployeeRead, EmployeeUpdate,
    TimeEntryCreate, TimeEntryRead, TimeEntryUpdate,
)
from filesystem import create_project_folders
from crud_timeentries import check_no_overlap

# -------------------------------------------------
# DB Schema anlegen
# -------------------------------------------------
Base.metadata.create_all(bind=engine)

app = FastAPI()

# -------------------------------------------------
# CORS
# -------------------------------------------------
origins = [
    "http://192.168.178.83:8080",
    "http://192.168.178.83",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"msg": "STech Backend + PostgreSQL laufen!"}


# -------------------------------------------------
# Helper: Dauer berechnen
# -------------------------------------------------

def compute_duration(entry: models.TimeEntry) -> None:
    """
    Berechnet entry.dauer_stunden aus start/ende/pause_min.
    NOP, wenn start oder ende fehlen.
    """
    if not entry.start or not entry.ende:
        return

    start_min = entry.start.hour * 60 + entry.start.minute
    end_min = entry.ende.hour * 60 + entry.ende.minute
    diff = max(0, end_min - start_min)

    pause = entry.pause_min or 0
    eff_min = max(0, diff - pause)

    entry.dauer_stunden = eff_min / 60.0


# ============================================================
#  K U N D E N
# ============================================================

@app.post("/customers/", response_model=CustomerRead)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    # Pydantic hat Pflichtfelder bereits geprüft (CustomerCreate)

    data = customer.model_dump()

    # Rechnungsadresse/-mail aus Stammdaten ableiten, falls leer
    if not data.get("rechnung_adresse"):
        data["rechnung_adresse"] = data.get("adresse")
        data["rechnung_plz"] = data.get("plz")
        data["rechnung_ort"] = data.get("ort")

    if not data.get("rechnung_email"):
        data["rechnung_email"] = data.get("email")

    db_customer = models.Customer(**data)
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers/", response_model=List[CustomerRead])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.id).all()


@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    has_projects = db.query(models.Project).filter(models.Project.customer_id == customer_id).first()
    has_times = db.query(models.TimeEntry).filter(models.TimeEntry.customer_id == customer_id).first()

    if has_projects or has_times:
        raise HTTPException(
            status_code=400,
            detail="Kunde hat noch Projekte oder Zeit-Einträge und kann nicht gelöscht werden.",
        )

    db.delete(cust)
    db.commit()
    return {"ok": True}


# ============================================================
#  P R O J E K T E
# ============================================================

@app.post("/projects/", response_model=ProjectRead)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    # Kunde prüfen
    customer = db.query(models.Customer).filter(
        models.Customer.id == project.customer_id
    ).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    # Projekt in DB anlegen
    db_project = models.Project(
        customer_id=project.customer_id,
        titel=project.titel,
        beschreibung=project.beschreibung,
        ist_offerte=project.ist_offerte,
        stundensatz=project.stundensatz,
        status=project.status or "Offen",
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Ordnerstruktur anlegen
    try:
        project_path = create_project_folders(
            customer_firma=customer.firma,
            project_id=db_project.id,
            project_title=db_project.titel,
        )
        db_project.projektpfad = str(project_path)
        db.commit()
        db.refresh(db_project)
    except Exception as e:
        print("Fehler beim Anlegen der Ordnerstruktur:", e)

    return db_project


@app.get("/projects/", response_model=List[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    # Nur Projekte mit Status "Offen" zurückgeben (für Zeit-Stempeln)
    projects = (
        db.query(models.Project)
        .join(models.Project.customer)
        .filter(models.Project.status == "Offen")
        .all()
    )
    return projects


@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    used = db.query(models.TimeEntry).filter(models.TimeEntry.project_id == project_id).first()
    if used:
        raise HTTPException(
            status_code=400,
            detail="Projekt hat noch Zeiteinträge und kann nicht gelöscht werden.",
        )

    # Projektordner löschen (unter /srv/stech/projects)
    if proj.projektpfad:
        try:
            base_dir = Path("/srv/stech/projects").resolve()
            p = Path(proj.projektpfad).resolve()
            if p.exists() and p.is_dir() and base_dir in p.parents:
                shutil.rmtree(p)
        except Exception as e:
            print("Warnung beim Löschen des Projektordners:", e)

    db.delete(proj)
    db.commit()
    return {"ok": True}


# ============================================================
#  M I T A R B E I T E R
# ============================================================

@app.post("/employees/", response_model=EmployeeRead)
def create_employee(emp: EmployeeCreate, db: Session = Depends(get_db)):
    db_emp = models.Employee(
        name=emp.name,
        kuerzel=emp.kuerzel,
        geburtsdatum=emp.geburtsdatum,
        ahv_nummer=emp.ahv_nummer,
        zivilstand=emp.zivilstand,
        kinderanzahl=emp.kinderanzahl,
        adresse=emp.adresse,
        plz=emp.plz,
        ort=emp.ort,
        email=emp.email,
        telefon=emp.telefon,
        notfallkontakt=emp.notfallkontakt,
        notfalltelefon=emp.notfalltelefon,
        eintrittsdatum=emp.eintrittsdatum,
        austrittsdatum=emp.austrittsdatum,
        pensum=emp.pensum,
        stunden_pro_woche=emp.stunden_pro_woche,
        lohnart=emp.lohnart,
        lohn=emp.lohn,
        dreizehnter=emp.dreizehnter,
        kadervertrag=emp.kadervertrag,
        ferienanspruch=emp.ferienanspruch,
        ferien_guthaben_stunden=emp.ferien_guthaben_stunden,
        ueberstunden_guthaben=emp.ueberstunden_guthaben,
        bvg_eintritt=emp.bvg_eintritt,
        bvg_pflichtig=emp.bvg_pflichtig,
        krankentaggeld_versichert=emp.krankentaggeld_versichert,
        unfallversicherung_priv=emp.unfallversicherung_priv,
        iban=emp.iban,
        bank=emp.bank,
        abteilung=emp.abteilung,
        rolle=emp.rolle,
        kostenstelle=emp.kostenstelle,
        qualifikationen=emp.qualifikationen,
        notizen_intern=emp.notizen_intern,
        krankentage=emp.krankentage,
        aktiv=emp.aktiv,
        erstellt_von=emp.erstellt_von,
        is_admin=emp.is_admin,
        can_manage_projects=emp.can_manage_projects,
        can_see_customers_projects=emp.can_see_customers_projects,
    )
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp


@app.get("/employees/", response_model=List[EmployeeRead])
def list_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()


@app.put("/employees/{emp_id}", response_model=EmployeeRead)
def update_employee(emp_id: int, emp: EmployeeUpdate, db: Session = Depends(get_db)):
    db_emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")

    data = emp.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_emp, field, value)

    db.commit()
    db.refresh(db_emp)
    return db_emp


# ============================================================
#  Z E I T E I N T R Ä G E
# ============================================================

@app.post("/timeentries/", response_model=TimeEntryRead)
def create_time_entry(entry: TimeEntryCreate, db: Session = Depends(get_db)):
    # Mitarbeiter prüfen
    emp = db.query(models.Employee).filter(models.Employee.id == entry.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")

    # Overlap nur prüfen, wenn Ende bereits gesetzt ist
    if entry.start is not None and entry.ende is not None:
        check_no_overlap(
            db=db,
            employee_id=entry.employee_id,
            start=entry.start,
            ende=entry.ende,
        )

    db_entry = models.TimeEntry(
        employee_id=entry.employee_id,
        customer_id=entry.customer_id,
        project_id=entry.project_id,
        datum=entry.datum,
        start=entry.start,
        ende=entry.ende,
        pause_min=entry.pause_min,
        dauer_stunden=entry.dauer_stunden,
        taetigkeit=entry.taetigkeit,
        details=entry.details,
        betrag=entry.betrag,
        quelle_datei=entry.quelle_datei,
        externe_id=entry.externe_id,
        quelle_system=entry.quelle_system or "api",
        uebermittelt=False,
    )

    # Dauer berechnen wenn start & ende vorhanden
    compute_duration(db_entry)

    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.get("/timeentries/", response_model=List[TimeEntryRead])
def list_time_entries(
    db: Session = Depends(get_db),
    employee_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    project_id: Optional[int] = None,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = None,
):
    q = db.query(models.TimeEntry)

    if employee_id:
        q = q.filter(models.TimeEntry.employee_id == employee_id)
    if customer_id:
        q = q.filter(models.TimeEntry.customer_id == customer_id)
    if project_id:
        q = q.filter(models.TimeEntry.project_id == project_id)
    if from_:
        q = q.filter(models.TimeEntry.datum >= from_)
    if to:
        q = q.filter(models.TimeEntry.datum <= to)

    entries = q.order_by(
        models.TimeEntry.datum.asc(),
        models.TimeEntry.start.asc()
    ).all()

    return entries


@app.get("/timeentries/running", response_model=Optional[TimeEntryRead])
def get_running_time_entry(
    employee_id: int,
    db: Session = Depends(get_db),
):
    """
    Offener Live-Stempel-Eintrag für diesen Mitarbeiter:
    start gesetzt, ende NULL, uebermittelt = False.
    """
    e = (
        db.query(models.TimeEntry)
        .filter(
            models.TimeEntry.employee_id == employee_id,
            models.TimeEntry.ende.is_(None),
            models.TimeEntry.uebermittelt.is_(False),
        )
        .order_by(
            models.TimeEntry.datum.desc(),
            models.TimeEntry.start.desc()
        )
        .first()
    )
    return e


@app.put("/timeentries/{entry_id}", response_model=TimeEntryRead)
def update_time_entry(
    entry_id: int,
    entry_update: TimeEntryUpdate,
    db: Session = Depends(get_db),
):
    db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")

    # Generisches Update
    data = entry_update.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_entry, field, value)

    # Overlap prüfen, wenn start & ende vorhanden
    if db_entry.start is not None and db_entry.ende is not None:
        check_no_overlap(
            db=db,
            employee_id=db_entry.employee_id,
            start=db_entry.start,
            ende=db_entry.ende,
            entry_id=db_entry.id,
        )
        # Dauer neu berechnen
        compute_duration(db_entry)

    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.delete("/timeentries/{entry_id}")
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    """
    Zeiteintrag löschen:
    - DB-Eintrag löschen
    - falls 'quelle_datei' auf eine Datei unter /srv/stech/projects zeigt → Datei löschen
    """
    db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")

    # Datei löschen (Option A: alles unter /srv/stech/projects ...)
    if db_entry.quelle_datei:
        try:
            base_dir = Path("/srv/stech/projects").resolve()
            p = Path(db_entry.quelle_datei)
            if not p.is_absolute():
                p = base_dir / p
            p = p.resolve()
            if p.exists() and p.is_file() and base_dir in p.parents:
                p.unlink()
        except Exception as e:
            print("Warnung beim Löschen der TimeEntry-Datei:", e)

    db.delete(db_entry)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------
#  Offene Einträge „übermitteln“ (sperren)
# ------------------------------------------------------------

@app.post("/timeentries/submit_open")
def submit_open_timeentries(
    employee_id: int,
    db: Session = Depends(get_db),
):
    """
    Markiert alle Einträge dieses Mitarbeiters als 'uebermittelt',
    die:
        - ein Ende haben
        - noch nicht uebermittelt wurden.
    """
    q = (
        db.query(models.TimeEntry)
        .filter(
            models.TimeEntry.employee_id == employee_id,
            models.TimeEntry.ende.is_not(None),
            models.TimeEntry.uebermittelt.is_(False),
        )
    )

    now = datetime.utcnow()
    count = 0
    for e in q:
        e.uebermittelt = True
        e.uebermittelt_am = now
        count += 1

    db.commit()
    return {"ok": True, "count": count}
