FROM nginx:alpine

# Standard-HTML-Verzeichnis
WORKDIR /usr/share/nginx/html

# Alle statischen Dateien (HTML, JS, CSS) in den Webroot kopieren
COPY . /usr/share/nginx/html

# Nginx läuft standardmäßig auf Port 80
EXPOSE 80
