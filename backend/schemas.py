from typing import Optional
from datetime import date, time, datetime
from pydantic import BaseModel, ConfigDict

# ============================================================
#  C U S T O M E R
# ============================================================

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


# ============================================================
#  P R O J E K T E
# ============================================================

class ProjectBase(BaseModel):
    customer_id: int
    titel: str
    beschreibung: Optional[str] = None
    ist_offerte: bool = False
    stundensatz: Optional[float] = None
    status: Optional[str] = "Offen"


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    projektpfad: Optional[str] = None

    # Anzeigezweck
    customer_firma: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
#  M I T A R B E I T E R
# ============================================================

class EmployeeBase(BaseModel):
    name: str

    # Persönlich
    kuerzel: Optional[str] = None
    geburtsdatum: Optional[date] = None
    ahv_nummer: Optional[str] = None
    zivilstand: Optional[str] = None
    kinderanzahl: Optional[int] = 0

    # Kontakt
    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email: Optional[str] = None
    telefon: Optional[str] = None
    notfallkontakt: Optional[str] = None
    notfalltelefon: Optional[str] = None

    # Arbeitsvertrag
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

    # Versicherungen
    bvg_eintritt: Optional[date] = None
    bvg_pflichtig: Optional[bool] = False
    krankentaggeld_versichert: Optional[bool] = True
    unfallversicherung_priv: Optional[bool] = False

    # Bank
    iban: Optional[str] = None
    bank: Optional[str] = None

    # Intern
    abteilung: Optional[str] = None
    rolle: Optional[str] = None
    kostenstelle: Optional[str] = None
    qualifikationen: Optional[str] = None
    notizen_intern: Optional[str] = None

    # Sonstiges
    krankentage: Optional[float] = 0.0
    aktiv: Optional[bool] = True
    erstellt_von: Optional[str] = None

    # Rechte
    is_admin: bool = False
    can_manage_projects: bool = False
    can_see_customers_projects: bool = False


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    # alles optional für PUT
    name: Optional[str] = None
    kuerzel: Optional[str] = None
    geburtsdatum: Optional[date] = None
    ahv_nummer: Optional[str] = None
    zivilstand: Optional[str] = None
    kinderanzahl: Optional[int] = None

    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email: Optional[str] = None
    telefon: Optional[str] = None
    notfallkontakt: Optional[str] = None
    notfalltelefon: Optional[str] = None

    eintrittsdatum: Optional[date] = None
    austrittsdatum: Optional[date] = None
    pensum: Optional[float] = None
    stunden_pro_woche: Optional[float] = None
    lohnart: Optional[str] = None
    lohn: Optional[float] = None
    dreizehnter: Optional[bool] = None
    kadervertrag: Optional[bool] = None

    ferienanspruch: Optional[float] = None
    ferien_guthaben_stunden: Optional[float] = None
    ueberstunden_guthaben: Optional[float] = None

    bvg_eintritt: Optional[date] = None
    bvg_pflichtig: Optional[bool] = None
    krankentaggeld_versichert: Optional[bool] = None
    unfallversicherung_priv: Optional[bool] = None

    iban: Optional[str] = None
    bank: Optional[str] = None

    abteilung: Optional[str] = None
    rolle: Optional[str] = None
    kostenstelle: Optional[str] = None
    qualifikationen: Optional[str] = None
    notizen_intern: Optional[str] = None

    krankentage: Optional[float] = None
    aktiv: Optional[bool] = None

    is_admin: Optional[bool] = None
    can_manage_projects: Optional[bool] = None
    can_see_customers_projects: Optional[bool] = None


class EmployeeRead(EmployeeBase):
    id: int
    erstellt_am: datetime
    geändert_am: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================
#  Z E I T E I N T R Ä G E
# ============================================================

class TimeEntryBase(BaseModel):
    employee_id: int
    customer_id: Optional[int] = None
    project_id: Optional[int] = None

    datum: date
    start: Optional[time] = None
    ende: Optional[time] = None
    pause_min: Optional[int] = None
    dauer_stunden: Optional[float] = None

    taetigkeit: Optional[str] = None
    details: Optional[str] = None
    betrag: Optional[float] = None


class TimeEntryCreate(TimeEntryBase):
    quelle_datei: Optional[str] = None
    externe_id: Optional[str] = None
    quelle_system: Optional[str] = None


class TimeEntryUpdate(BaseModel):
    datum: Optional[date] = None
    start: Optional[time] = None
    ende: Optional[time] = None
    pause_min: Optional[int] = None
    dauer_stunden: Optional[float] = None
    taetigkeit: Optional[str] = None
    details: Optional[str] = None
    customer_id: Optional[int] = None
    project_id: Optional[int] = None
    betrag: Optional[float] = None

    # NEU: darf nur Admin setzen, aber Schema ist nötig
    uebermittelt: Optional[bool] = None


class TimeEntryRead(TimeEntryBase):
    id: int
    erstellt_am: datetime

    projektpfad: Optional[str] = None
    customer_firma: Optional[str] = None
    employee_name: Optional[str] = None

    # NEU – Sperr-Status
    uebermittelt: bool
    uebermittelt_am: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
