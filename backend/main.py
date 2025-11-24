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

Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS-Konfiguration
origins = [
    "http://192.168.178.83",
    "http://192.168.178.83:8080",
    "http://stechadmin",
    "http://stechadmin:8080",
    "http://localhost",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # wir brauchen aktuell keine Cookies
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


# ============================================================
#  K U N D E N
# ============================================================

@app.post("/customers/", response_model=CustomerRead)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = models.Customer(**customer.model_dump())
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
    # Nur offene Projekte → nur auf diese soll gestempelt werden
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

    # Projektordner auf dem OS löschen
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
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    return TimeEntryRead(
        id=db_entry.id,
        employee_id=db_entry.employee_id,
        customer_id=db_entry.customer_id,
        project_id=db_entry.project_id,
        datum=db_entry.datum,
        start=db_entry.start,
        ende=db_entry.ende,
        pause_min=db_entry.pause_min,
        dauer_stunden=db_entry.dauer_stunden,
        taetigkeit=db_entry.taetigkeit,
        details=db_entry.details,
        betrag=db_entry.betrag,
        uebermittelt=db_entry.uebermittelt,
        uebermittelt_am=db_entry.uebermittelt_am,
        erstellt_am=db_entry.erstellt_am,
        projektpfad=db_entry.project.projektpfad if db_entry.project else None,
        customer_firma=db_entry.customer.firma if db_entry.customer else None,
        employee_name=db_entry.employee.name if db_entry.employee else None,
    )


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

    # sortiert nach Datum + Startzeit
    entries = q.order_by(
        models.TimeEntry.datum.asc(),
        models.TimeEntry.start.asc()
    ).all()

    result: list[TimeEntryRead] = []
    for e in entries:
        result.append(
            TimeEntryRead(
                id=e.id,
                employee_id=e.employee_id,
                customer_id=e.customer_id,
                project_id=e.project_id,
                datum=e.datum,
                start=e.start,
                ende=e.ende,
                pause_min=e.pause_min,
                dauer_stunden=e.dauer_stunden,
                taetigkeit=e.taetigkeit,
                details=e.details,
                betrag=e.betrag,
                uebermittelt=e.uebermittelt,
                uebermittelt_am=e.uebermittelt_am,
                erstellt_am=e.erstellt_am,
                projektpfad=e.project.projektpfad if e.project else None,
                customer_firma=e.customer.firma if e.customer else None,
                employee_name=e.employee.name if e.employee else None,
            )
        )
    return result


@app.get("/timeentries/running", response_model=Optional[TimeEntryRead])
def get_running_time_entry(
    employee_id: int,
    db: Session = Depends(get_db),
):
    """
    Offener Live-Stempel-Eintrag für diesen Mitarbeiter:
    start gesetzt, ende NULL.
    """
    e = (
        db.query(models.TimeEntry)
        .filter(
            models.TimeEntry.employee_id == employee_id,
            models.TimeEntry.ende.is_(None),
        )
        .order_by(
            models.TimeEntry.datum.desc(),
            models.TimeEntry.start.desc()
        )
        .first()
    )
    if not e:
        return None

        return TimeEntryRead(
        id=e.id,
        employee_id=e.employee_id,
        customer_id=e.customer_id,
        project_id=e.project_id,
        datum=e.datum,
        start=e.start,
        ende=e.ende,
        pause_min=e.pause_min,
        dauer_stunden=e.dauer_stunden,
        taetigkeit=e.taetigkeit,
        details=e.details,
        betrag=e.betrag,
        uebermittelt=e.uebermittelt,
        uebermittelt_am=e.uebermittelt_am,
        erstellt_am=e.erstellt_am,
        projektpfad=e.project.projektpfad if e.project else None,
        customer_firma=e.customer.firma if e.customer else None,
        employee_name=e.employee.name if e.employee else None,
    )


@app.put("/timeentries/{entry_id}", response_model=TimeEntryRead)
def update_time_entry(
    entry_id: int,
    entry_update: TimeEntryUpdate,
    db: Session = Depends(get_db),
    force_admin: bool = Query(False),
):
    """
    Zeiteintrag aktualisieren.
    Wenn der Eintrag bereits uebermittelt wurde, ist eine Änderung nur erlaubt,
    wenn force_admin=True übergeben wird (Admin-Fall).
    """
    db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")

    # Sperre: nach Übermittlung nur noch Admin (force_admin) darf anpassen
    if getattr(db_entry, "uebermittelt", False) and not force_admin:
        raise HTTPException(
            status_code=403,
            detail="Zeiteintrag wurde bereits übermittelt und kann nicht mehr geändert werden.",
        )

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

    db.commit()
    db.refresh(db_entry)

    return TimeEntryRead(
        id=db_entry.id,
        employee_id=db_entry.employee_id,
        customer_id=db_entry.customer_id,
        project_id=db_entry.project_id,
        datum=db_entry.datum,
        start=db_entry.start,
        ende=db_entry.ende,
        pause_min=db_entry.pause_min,
        dauer_stunden=db_entry.dauer_stunden,
        taetigkeit=db_entry.taetigkeit,
        details=db_entry.details,
        betrag=db_entry.betrag,
        uebermittelt=db_entry.uebermittelt,
        uebermittelt_am=db_entry.uebermittelt_am,
        erstellt_am=db_entry.erstellt_am,
        projektpfad=db_entry.project.projektpfad if db_entry.project else None,
        customer_firma=db_entry.customer.firma if db_entry.customer else None,
        employee_name=db_entry.employee.name if db_entry.employee else None,
    )


@app.delete("/timeentries/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    force_admin: bool = Query(False),
):
    """
    Zeiteintrag löschen:
    - DB-Eintrag löschen
    - falls 'quelle_datei' auf eine Datei unter /srv/stech/projects zeigt → Datei löschen
    - Wenn uebermittelt=True, nur mit force_admin erlaubt.
    """
    db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")

    if getattr(db_entry, "uebermittelt", False) and not force_admin:
        raise HTTPException(
            status_code=403,
            detail="Zeiteintrag wurde bereits übermittelt und kann nicht mehr gelöscht werden.",
        )

    # Datei löschen
    if db_entry.quelle_datei:
        try:
            base_dir = Path("/srv/stech/projects").resolve()
            p = Path(db_entry.quelle_datei)
            # relativ → unter base_dir annehmen
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


# ============================================================
#  Z E I T E I N T R Ä G E   Ü B E R M I T T E L N
# ============================================================

@app.post("/timeentries/submit")
def submit_time_entries(
    db: Session = Depends(get_db),
    employee_id: int = Query(..., description="Mitarbeiter-ID"),
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = None,
):
    """
    Markiert alle Zeiteinträge eines Mitarbeiters im Zeitraum als 'uebermittelt'.
    Danach sind sie für normale Benutzer gesperrt (Update/Delete nur noch mit force_admin).
    """
    q = db.query(models.TimeEntry).filter(
        models.TimeEntry.employee_id == employee_id,
        models.TimeEntry.uebermittelt.is_(False),
    )

    if from_:
        q = q.filter(models.TimeEntry.datum >= from_)
    if to:
        q = q.filter(models.TimeEntry.datum <= to)

    entries = q.all()
    now = datetime.utcnow()

    for e in entries:
        e.uebermittelt = True
        e.uebermittelt_am = now

    db.commit()

    return {
        "ok": True,
        "employee_id": employee_id,
        "count": len(entries),
        "from": from_,
        "to": to,
    }
