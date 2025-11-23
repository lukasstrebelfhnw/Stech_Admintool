from typing import Optional
from datetime import date, time, datetime
from pydantic import BaseModel, ConfigDict


# ---------- Customer ----------

class CustomerBase(BaseModel):
    firma: str
    kontaktperson: Optional[str] = None
    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email: Optional[str] = None
    telefon: Optional[str] = None
    stundensatz_standard: Optional[float] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerRead(CustomerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Project ----------

class ProjectBase(BaseModel):
    customer_id: int
    titel: str
    beschreibung: Optional[str] = None
    ist_offerte: bool = False
    stundensatz: Optional[float] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    projektpfad: Optional[str] = None
    status: str
    # NEU: Firmenname für Anzeige
    customer_firma: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



# ---------- Employee ----------

class EmployeeBase(BaseModel):
    # alles optional, bis auf name, damit du flexibel Mitarbeiter anlegen kannst
    name: str
    kuerzel: Optional[str] = None
    geburtsdatum: Optional[date] = None
    ahv_nummer: Optional[str] = None
    zivilstand: Optional[str] = None
    kinderanzahl: Optional[int] = 0

    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email: Optional[str] = None
    telefon: Optional[str] = None
    notfallkontakt: Optional[str] = None
    notfalltelefon: Optional[str] = None

    eintrittsdatum: Optional[date] = None
    austrittsdatum: Optional[date] = None
    pensum: Optional[float] = 100.0
    stunden_pro_woche: Optional[float] = 42
    lohnart: Optional[str] = None
    lohn: Optional[float] = None
    dreizehnter: Optional[bool] = True
    kadervertrag: Optional[bool] = False

    ferienanspruch: Optional[float] = None
    ferien_guthaben_stunden: Optional[float] = 0.0
    ueberstunden_guthaben: Optional[float] = 0.0

    bvg_eintritt: Optional[date] = None
    bvg_pflichtig: Optional[bool] = False
    krankentaggeld_versichert: Optional[bool] = True
    unfallversicherung_priv: Optional[bool] = False

    iban: Optional[str] = None
    bank: Optional[str] = None

    abteilung: Optional[str] = None
    rolle: Optional[str] = None
    kostenstelle: Optional[str] = None
    qualifikationen: Optional[str] = None
    notizen_intern: Optional[str] = None

    krankentage: Optional[float] = 0.0
    aktiv: Optional[bool] = True
    erstellt_von: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    # falls du später Pflichtfelder erzwingen willst, kannst du hier enger machen
    pass


class EmployeeRead(EmployeeBase):
    id: int
    erstellt_am: datetime
    geändert_am: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- TimeEntry ----------

class TimeEntryBase(BaseModel):
    employee_id: int
    customer_id: Optional[int] = None
    project_id: Optional[int] = None

    datum: date
    start: Optional[time] = None
    ende: Optional[time] = None
    pause_min: Optional[int] = None
    dauer_stunden: float

    taetigkeit: Optional[str] = None
    details: Optional[str] = None
    betrag: Optional[float] = None


class TimeEntryCreate(TimeEntryBase):
    quelle_datei: Optional[str] = None
    externe_id: Optional[str] = None
    quelle_system: Optional[str] = None


class TimeEntryRead(TimeEntryBase):
    id: int
    projektpfad: Optional[str] = None
    customer_firma: Optional[str] = None
    employee_name: Optional[str] = None
    erstellt_am: datetime

    model_config = ConfigDict(from_attributes=True)