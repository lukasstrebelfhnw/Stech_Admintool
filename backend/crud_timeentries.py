from fastapi import HTTPException
from sqlalchemy.orm import Session
from models import TimeEntry

def check_no_overlap(
    db: Session,
    employee_id: int,
    start,
    ende,
    entry_id: int | None = None,
):
    """
    Prüft, ob es für diesen Mitarbeiter bereits einen Eintrag gibt,
    der sich mit [start, ende] überschneidet.
    """
    if start is None or ende is None:
        return  # Wenn noch kein Ende gesetzt, ggf. später prüfen

    q = db.query(TimeEntry).filter(TimeEntry.employee_id == employee_id)

    if entry_id is not None:
        q = q.filter(TimeEntry.id != entry_id)

    # Overlap-Bedingung: (start < anderes_ende) und (ende > anderer_start)
    q = q.filter(TimeEntry.start < ende, TimeEntry.ende > start)

    if db.query(q.exists()).scalar():
        raise HTTPException(
            status_code=400,
            detail="Zeiteinträge dürfen sich nicht überschneiden.",
        )
