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