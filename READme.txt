sudo rm -rf Verzeichnisname: 
Verwenden Sie -r für rekursives Löschen, 
wenn Sie ein Verzeichnis mit allen seinen Inhalten und Unterordnern löschen möchten.

docker logs stech_backend --tail=50 Fehler suchen


JSON Timeapp
{
  "employee_id": 1,
  "customer_id": 5,
  "project_id": 12,
  "datum": "2025-11-23",
  "start": "07:30:00",
  "ende": "16:45:00",
  "pause_min": 45,
  "dauer_stunden": 8.5,
  "taetigkeit": "Montage vor Ort",
  "details": "Schaltschrank verdrahtet",
  "betrag": 0,
  "quelle_system": "app",
  "externe_id": "APP-2025-11-23-1234"
}

Docker Befehle

docker compose down

Backnd Image löschen
docker rmi app-backend || true

BuildCache aufräumen
docker builder prune -af

Docker Builden
docker compose up --build -d

Fehler suchen
docker logs stech_backend --tail=50

Datenbank löschen
sudo rm -rf db

Git
Änderungen einem commit hinzufügen
git add .
Commit mit Kommentar
git commit -m "Zeiterfassung,Datenmangement,Admin angepasst_V2"
Auf GitHub pushen
git push

OS
Projekte auf OS löschen
sudo rm -rf /srv/stech/projects/2025/*


BUGS:

Beim alle Zeittrackings sollen weiterlaufen, auch wenn man den Mitarbeiter wechselt. 

TODOS:
-Im Adminportal soll eine Krank fkt eingebaut werden. dazu muss man den Mitarbeiter anwählen und den Button Krank drücken dann werden jeden Tag die Stunden automatisch mit dem Kunden Intern und Tätigkeit Krank gefüllt, 
bis der Angestellte das erste mal wieder einstempelt.

-Einfügen von Lieferanten in die Datenbank--> Es muss der Tätigkeitsbereich der Firma angegeben werden. Diese Tätigkeiten helfen dann beim Anfragen von Bauteilen wenn man das Stech Datamanagement dazu nimmt.
Ebenfalls dienen die Lieferanten als Kontrolle von bezahlten und offenen Rechnungen

-Bei Mitarbeiter anlegen Lohnart als Dropdown

BUGS:
Beim Stempeln am 25.11 hat das Datum nicht geändert, da Seite nicht neu geladen wurde.. 
Neu Laden erzwingen
Laufend seit anpassen auf gewählten Mitarbeiter -->Zeiterfassung-->Live-Stempeln