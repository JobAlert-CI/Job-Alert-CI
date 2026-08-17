# Scrapers JobAlert CI

Ce dossier contient les scripts Playwright/selectolax de collecte. Ils ne doivent pas ecrire en base directement.

Par defaut, chaque script continue de produire son fichier JSON local. Pour envoyer aussi les offres a l'API FastAPI, activez l'envoi :

```powershell
$env:SCRAPER_SEND_TO_API="1"
$env:SCRAPER_API_BASE_URL="http://localhost:8000"
$env:SCRAPER_API_TOKEN="change-me-scraper-token"
```

Exemples :

```powershell
python scrapers\GoAfrica\script.py
python scrapers\JobIvoire\script.py
python scrapers\Educarriere\script.py
```

Il est aussi possible d'envoyer un fichier JSON deja scrape :

```powershell
python -m scrapers.common.ingestion goafrica scrapers\GoAfrica\donnees_jobs.json
python -m scrapers.common.ingestion jobivoire scrapers\JobIvoire\donnees_jobs_jobivoire.json
python -m scrapers.common.ingestion educarriere scrapers\Educarriere\donnees_jobs_Educ.json
```

Les scripts envoient uniquement les codes de referentiels reconnus par le backend. Les libelles non mappes restent dans `raw_data`, ce qui evite de rejeter une offre a cause d'un vocabulaire propre a une source.

Pour forcer une filiere connue sur tout un run :

```powershell
$env:SCRAPER_DEFAULT_FILIERE_CODE="tech-dev"
```

Avec Celery, la tache `run_source_scraper(source_code)` lance les scripts locaux pour `goafrica`, `jobivoire` et `educarriere`. Si les scrapers utilisent un environnement Python separe, definissez :

```powershell
$env:SCRAPER_PYTHON="C:\chemin\vers\venv\Scripts\python.exe"
```
