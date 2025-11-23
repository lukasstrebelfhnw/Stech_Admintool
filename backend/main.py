from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from db import SessionLocal, engine, Base
import models
import schemas
from filesystem import create_project_folders  # wie gehabt

Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS-Konfiguration: Frontend darf aufs Backend zugreifen
origins = [
    "http://192.168.178.83:8080",  # dein nginx-Frontend
    "http://192.168.178.83",       # falls du direkt testest
    "http://localhost:8080",       # optional für lokalen Test
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


# ---------- Kunden ----------

@app.post("/customers/", response_model=schemas.CustomerRead)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers/", response_model=List[schemas.CustomerRead])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.id).all()


# ---------- Projekte ----------

@app.post("/projects/", response_model=schemas.ProjectRead)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    # Kunde prüfen
    customer = db.query(models.Customer).filter(
        models.Customer.id == project.customer_id
    ).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    # Projekt in DB anlegen (Pfad erst mal leer)
    db_project = models.Project(
        customer_id=project.customer_id,
        titel=project.titel,
        beschreibung=project.beschreibung,
        ist_offerte=project.ist_offerte,
        stundensatz=project.stundensatz,
        status="neu",
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


@app.get("/projects/", response_model=List[schemas.ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    # join, damit customer geladen ist (für customer_firma)
    projects = db.query(models.Project).join(models.Project.customer).all()
    return projects

# ---------- Mitarbeiter ----------

@app.post("/employees/", response_model=schemas.EmployeeRead)
def create_employee(emp: schemas.EmployeeCreate, db: Session = Depends(get_db)):
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
    )
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp


@app.get("/employees/", response_model=List[schemas.EmployeeRead])
def list_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

# ---------- Time Entries ----------

@app.post("/timeentries/", response_model=schemas.TimeEntryRead)
def create_time_entry(entry: schemas.TimeEntryCreate, db: Session = Depends(get_db)):
    # Optional: Validierung, ob Employee existiert
    emp = db.query(models.Employee).filter(models.Employee.id == entry.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")

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

    return schemas.TimeEntryRead(
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
        erstellt_am=db_entry.erstellt_am,
        projektpfad=db_entry.project.projektpfad if db_entry.project else None,
        customer_firma=db_entry.customer.firma if db_entry.customer else None,
        employee_name=db_entry.employee.name if db_entry.employee else None,
    )

@app.get("/timeentries/", response_model=List[schemas.TimeEntryRead])
def list_time_entries(
    db: Session = Depends(get_db),
    employee_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    project_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    q = db.query(models.TimeEntry)

    if employee_id:
        q = q.filter(models.TimeEntry.employee_id == employee_id)
    if customer_id:
        q = q.filter(models.TimeEntry.customer_id == customer_id)
    if project_id:
        q = q.filter(models.TimeEntry.project_id == project_id)
    if from_date:
        q = q.filter(models.TimeEntry.datum >= from_date)
    if to_date:
        q = q.filter(models.TimeEntry.datum <= to_date)

    entries = q.all()
    result = []
    for e in entries:
        result.append(
            schemas.TimeEntryRead(
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
                erstellt_am=e.erstellt_am,
                projektpfad=e.project.projektpfad if e.project else None,
                customer_firma=e.customer.firma if e.customer else None,
                employee_name=e.employee.name if e.employee else None,
            )
        )
    return result