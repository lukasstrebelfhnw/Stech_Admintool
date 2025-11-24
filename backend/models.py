# backend/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    Time,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    firma = Column(String, nullable=False)
    kontaktperson = Column(String, nullable=True)
    adresse = Column(String, nullable=True)
    plz = Column(String, nullable=True)
    ort = Column(String, nullable=True)
    email = Column(String, nullable=True)
    telefon = Column(String, nullable=True)
    stundensatz_standard = Column(Float, nullable=True)
    erstellt_am = Column(DateTime, default=datetime.utcnow)

    # Beziehungen
    projects = relationship("Project", back_populates="customer")
    time_entries = relationship("TimeEntry", back_populates="customer")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    titel = Column(String, index=True)
    beschreibung = Column(String, nullable=True)
    ist_offerte = Column(Boolean, default=False)
    stundensatz = Column(Float, nullable=True)
    status = Column(String, default="neu")
    projektpfad = Column(String, nullable=True)

    # Beziehungen
    customer = relationship("Customer", back_populates="projects")
    time_entries = relationship("TimeEntry", back_populates="project")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)

    # Persönlich
    name = Column(String, nullable=False)
    kuerzel = Column(String)
    geburtsdatum = Column(Date)
    ahv_nummer = Column(String)
    zivilstand = Column(String)
    kinderanzahl = Column(Integer, default=0)

    # Kontakt
    adresse = Column(String)
    plz = Column(String)
    ort = Column(String)
    email = Column(String)
    telefon = Column(String)
    notfallkontakt = Column(String)
    notfalltelefon = Column(String)

    # Arbeitsvertrag
    eintrittsdatum = Column(Date)
    austrittsdatum = Column(Date)
    pensum = Column(Float, default=100.0)
    stunden_pro_woche = Column(Float, default=42)
    lohnart = Column(String)  # "stundenlohn" / "monatslohn"
    lohn = Column(Float)
    dreizehnter = Column(Boolean, default=True)
    kadervertrag = Column(Boolean, default=False)

    ferienanspruch = Column(Float)  # Tage/Jahr
    ferien_guthaben_stunden = Column(Float, default=0.0)
    ueberstunden_guthaben = Column(Float, default=0.0)

    # Versicherungen
    bvg_eintritt = Column(Date)
    bvg_pflichtig = Column(Boolean, default=False)
    krankentaggeld_versichert = Column(Boolean, default=True)
    unfallversicherung_priv = Column(Boolean, default=False)

    # Bank
    iban = Column(String)
    bank = Column(String)

    # Intern
    abteilung = Column(String)
    rolle = Column(String)
    kostenstelle = Column(String)
    qualifikationen = Column(Text)
    notizen_intern = Column(Text)

    # Sonstiges
    krankentage = Column(Float, default=0)
    aktiv = Column(Boolean, default=True)

    # System
    erstellt_am = Column(DateTime, default=datetime.utcnow)
    geändert_am = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    erstellt_von = Column(String)

    # Rollen / Rechte
    is_admin = Column(Boolean, default=False, nullable=False)
    can_manage_projects = Column(Boolean, default=False, nullable=False)
    can_see_customers_projects = Column(Boolean, default=False, nullable=False)

    # Beziehungen
    time_entries = relationship("TimeEntry", back_populates="employee")


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    datum = Column(Date, nullable=False)
    start = Column(Time, nullable=True)
    ende = Column(Time, nullable=True)
    pause_min = Column(Integer, nullable=True)          # Pause in Minuten
    dauer_stunden = Column(Float, nullable=True)

    taetigkeit = Column(String, nullable=True)
    details = Column(String, nullable=True)
    betrag = Column(Float, nullable=True)

    # Für CSV-Import / Stempel-App
    quelle_datei = Column(String, nullable=True)        # z.B. "Export_April.xlsx"
    externe_id = Column(String, nullable=True)          # ID aus Stempel-App, falls vorhanden
    quelle_system = Column(String, nullable=True)       # z.B. "csv", "app", "manuell"

    erstellt_am = Column(DateTime, default=datetime.utcnow)

    # Beziehungen
    employee = relationship("Employee", back_populates="time_entries")
    customer = relationship("Customer", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")
