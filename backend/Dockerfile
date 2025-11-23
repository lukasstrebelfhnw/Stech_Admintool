FROM python:3.11-slim

WORKDIR /app

# zuerst nur requirements kopieren und installieren
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# dann den Rest vom Code kopieren
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
