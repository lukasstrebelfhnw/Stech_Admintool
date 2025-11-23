# backend/filesystem.py
import os
import re
from pathlib import Path
from datetime import datetime

# Template-Struktur relativ zum Projektordner
FOLDER_TEMPLATE = [
    "01_Projektmanagement/01_Abklärung",
    "01_Projektmanagement/02_Anfragen/01_Eingehende_Offerten",
    "01_Projektmanagement/02_Anfragen/02_Eigene_Anfragen",
    "01_Projektmanagement/03_Angebot",
    "01_Projektmanagement/04_Bestellungen",
    "01_Projektmanagement/05_Lieferscheine",
    "01_Projektmanagement/06_Auftrag/01_Offerten",
    "01_Projektmanagement/06_Auftrag/02_Bestellung",
    "01_Projektmanagement/06_Auftrag/03_Vertrag",
    "01_Projektmanagement/07_Terminplan",
    "01_Projektmanagement/08_Korrespondenz",
    "01_Projektmanagement/09_Besprechungen/01_Protokolle",
    "01_Projektmanagement/10_Fotos",

    "02_Technik/01_Mechanik_CAD/01_SolidWorks",
    "02_Technik/01_Mechanik_CAD/02_Fertigung",
    "02_Technik/01_Mechanik_CAD/02_Fertigung/01_Extern",   
    "02_Technik/01_Mechanik_CAD/02_Fertigung/02_Intern",
    "02_Technik/01_Mechanik_CAD/03_Berechnungen",

    "02_Technik/02_Automation_Software/01_Elektroplanung/01_Schemas",
    "02_Technik/02_Automation_Software/01_Elektroplanung/02_Klemmenplaene_Stuecklisten",
    "02_Technik/02_Automation_Software/02_Software/01_SPS",
    "02_Technik/02_Automation_Software/02_Software/02_HMI_SCADA",
    "02_Technik/02_Automation_Software/02_Software/03_Antriebe",
    "02_Technik/02_Automation_Software/02_Software/04_Skripte_Tools",

    "03_Kaufmännisch/03_Rechnungen/01_Eingang",
    "03_Kaufmännisch/03_Rechnungen/02_Ausgang",
    "99_Archiv",
]


# Basis-Verzeichnis für Projekte im Container
BASE_DIR = Path("/srv/stech/projects")

_slug_re = re.compile(r"[^a-zA-Z0-9]+")

def slugify(text: str) -> str:
    """
    Macht aus 'Neue Steuerung V2.0' -> 'Neue_Steuerung_V2_0'
    (keine Sonderzeichen, gut für Ordnernamen)
    """
    text = text.strip()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s-]+", "_", text)
    return text


def create_project_folders(
    customer_firma: str,
    project_id: int,
    project_title: str,
) -> Path:
    """
    Legt die Projektordner an mit Schema:
    <jahr>/<projektname>_K<customer_id>_<jahr><counter>

    Beispiel:
    /srv/stech/projects/2025/neue_steuerung_K5_2025001/...
    """

    year = datetime.utcnow().year
    year_dir = BASE_DIR / str(year)
    year_dir.mkdir(parents=True, exist_ok=True)

    # Laufnummer = Anzahl existierender Projektverzeichnisse in diesem Jahr + 1
    existing_dirs = [p for p in year_dir.iterdir() if p.is_dir()]
    #TODO:
    """wenn vorhandene Ordner gelöscht wurden, kann es zu Lücken kommen. Und zwei gleiche Nummern.
    Besser: höchste vorhandene Nummer suchen und +1 machen.
    """
    counter = len(existing_dirs) + 1
    # 2025 + 001 => "2025001"
    code = f"{year}{counter:03d}"

    safe_title = slugify(project_title)
    safe_firma = slugify(customer_firma)

    # Gemäss Wunsch: Projektname_Firmenname_Jahr_count (Jahr+count als Code)
    folder_name = f"{safe_title}_{project_id}_{safe_firma}_{code}"

    # Root-Ordner (Kunde + Projekt) anlegen
    project_root = year_dir / folder_name
    project_root.mkdir(parents=True, exist_ok=True)

    # Unterordner laut Template anlegen
    for rel in FOLDER_TEMPLATE:
        (project_root / rel).mkdir(parents=True, exist_ok=True)

    return project_root