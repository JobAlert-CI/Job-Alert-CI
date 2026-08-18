import json
import os
import random
import re
import shutil
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urljoin, urlparse, urlunparse

import unicodedata
from dotenv import load_dotenv
from loguru import logger
from playwright.sync_api import (
    Error as PlaywrightError,
    Locator,
    Page,
    Route,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)
from selectolax.parser import HTMLParser

# Chargement du .env
load_dotenv()

# Optionnel : playwright-stealth
try:
    from playwright_stealth import Stealth
    STEALTH_MODE = "class"
except ImportError:
    try:
        from playwright_stealth import stealth_sync as _stealth_sync
        STEALTH_MODE = "function"
    except ImportError:
        STEALTH_MODE = None
        _stealth_sync = None

# Import du parser d'offres
from extract_offer import parse_job_html

# =============================================================================
# CONFIGURATION - PRÉFIXE JIV_
# =============================================================================

BASE_URL = os.getenv("JIV_BASE_URL", "https://www.jobivoire.ci/job").strip()
OUTPUT_FILE = Path(os.getenv("JIV_OUTPUT_FILE", "donnees_jobs_jobivoire.json"))
FAILED_FILE = Path(os.getenv("JIV_FAILED_FILE", "failed_jobs_jobivoire.json"))
LOG_FILE = Path(os.getenv("JIV_LOG_FILE", "logsJobIvoire.log"))

HEADLESS = os.getenv("JIV_HEADLESS", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

try:
    MAX_PAGES = max(1, int(os.getenv("JIV_MAX_PAGES", "20")))
except ValueError:
    MAX_PAGES = 20

try:
    MAX_JOBS = max(0, int(os.getenv("JIV_MAX_JOBS", "0")))
except ValueError:
    MAX_JOBS = 0

# =============================================================================
# FILTRE DE FRAÎCHEUR DES OFFRES
# =============================================================================

try:
    MAX_DAYS_OLD = int(os.getenv("SCRAPER_MAX_DAYS_OLD", "1"))
except ValueError:
    MAX_DAYS_OLD = 1

CHECK_EXPIRATION = os.getenv("SCRAPER_CHECK_EXPIRATION", "1").strip().lower() in {
    "1", "true", "yes", "on",
}

CARD_SELECTORS = (
    "div.job-item.position-relative.overflow-hidden.job-card",
    "div.job-card.job-item",
    "div.job-card",
    "div.job-item",
    "article.job-item",
)

MOIS_FR = {
    "janvier": "01", "fevrier": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "decembre": "12",
}

MONTH_ALIASES = {
    "jan": "janvier", "fev": "fevrier", "feb": "fevrier", "mar": "mars",
    "avr": "avril", "apr": "avril", "mai": "mai", "jun": "juin",
    "jui": "juin", "jul": "juillet", "aou": "aout", "aug": "aout",
    "sep": "septembre", "oct": "octobre", "nov": "novembre", "dec": "decembre",
}

CARD_LINK_SELECTORS = (
    "a.stretched-link",
    "a.job-link",
    "a[href]",
)

PUBLISHED_DATE_SELECTORS = (
    "div.job-item-meta ul li",
    "div.job-item-meta li",
    "ul.list-wrap li",
)

EXPIRATION_DATE_SELECTORS = (
    "div.job-card-header div.job-deadline",
    "div.job-deadline",
    "div[class*='deadline']",
)

try:
    NAVIGATION_TIMEOUT_MS = int(os.getenv("JIV_NAV_TIMEOUT_MS", "45000"))
except ValueError:
    NAVIGATION_TIMEOUT_MS = 45000

try:
    ACTION_TIMEOUT_MS = int(os.getenv("JIV_ACTION_TIMEOUT_MS", "8000"))
except ValueError:
    ACTION_TIMEOUT_MS = 8000

LOG_LEVEL = os.getenv("JIV_LOG_LEVEL", "INFO").strip().upper()
if LOG_LEVEL not in {"TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"}:
    LOG_LEVEL = "INFO"

BLOCKED_RESOURCE_TYPES = {"image", "font"}

USER_AGENT = os.getenv(
    "USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)

parsed_base = urlparse(BASE_URL)
ALLOWED_NETLOC = parsed_base.netloc.lower()
BASE_DOMAIN = ALLOWED_NETLOC.split(":")[0]
if BASE_DOMAIN.startswith("www."):
    BASE_DOMAIN = BASE_DOMAIN[4:]

SCRAPERS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRAPERS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_ROOT))

from common.ingestion import maybe_send_jobs_to_api

# =============================================================================
# SÉLECTEURS
# =============================================================================

JOB_CARD_SELECTORS = (
    "div.job-item.job-card.shadow-lite",
    "div.job-card",
    "div.job-item",
    "article.job-item",
)

JOB_LINK_SELECTORS = (
    "a.stretched-link",
    "a.job-link",
    "a[href]",
)

NEXT_PAGE_SELECTORS = (
    'a.page-link[aria-label="Suivant"]',
    'a[aria-label="Next"]',
    'a.next',
    'li.next a',
    'a:has-text("Suivant")',
)

JOB_URL_KEYWORDS = (
    "job",
    "offre",
    "emploi",
    "poste",
    "annonce",
    "recrutement",
    "detail",
)

# =============================================================================
# LOGGING
# =============================================================================

def setup_logger() -> None:
    """Configure les logs avec rotation et niveaux appropriés"""
    logger.remove()

    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        print(f"Impossible de créer le dossier de logs : {exc}", file=sys.stderr)

    # Fichier de logs détaillé
    logger.add(
        str(LOG_FILE),
        level="DEBUG",
        rotation="10 MB",
        retention="14 days",
        compression="zip",
        encoding="utf-8",
        backtrace=True,
        diagnose=False,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}"
    )

    # Console
    logger.add(
        sys.stderr,
        level=LOG_LEVEL,
        backtrace=True,
        diagnose=False,
    )

# =============================================================================
# OUTILS GÉNÉRIQUES
# =============================================================================

def retry_sync(
    func: Callable[[], Any],
    *,
    attempts: int = 3,
    min_delay: float = 1.0,
    max_delay: float = 8.0,
    what: str = "opération",
) -> Any:
    """Réessaie une fonction avec backoff exponentiel"""
    last_exception: Optional[Exception] = None

    for attempt in range(1, attempts + 1):
        try:
            return func()
        except (
            PlaywrightError,
            PlaywrightTimeoutError,
            ConnectionError,
            TimeoutError,
            OSError,
        ) as exc:
            last_exception = exc

            if attempt >= attempts:
                break

            delay = min(
                max_delay,
                min_delay * (2 ** (attempt - 1)) + random.uniform(0.0, 0.5),
            )

            logger.warning(
                f"{what} : tentative {attempt}/{attempts} échouée "
                f"({exc.__class__.__name__}: {exc}). "
                f"Nouvelle tentative dans {delay:.2f}s."
            )
            time.sleep(delay)

    logger.error(f"{what} : échec définitif après {attempts} tentative(s).")

    if last_exception:
        raise last_exception

    return None


def human_wait(page: Optional[Page], min_s: float = 1.0, max_s: float = 3.0) -> None:
    """Attend un délai aléatoire pour simuler un comportement humain"""
    delay = random.uniform(min_s, max_s)

    if page is None:
        time.sleep(delay)
        return

    try:
        page.wait_for_timeout(int(delay * 1000))
    except Exception as exc:
        logger.debug(f"human_wait via Playwright impossible, fallback time.sleep : {exc}")
        time.sleep(delay)


def clean_text(value: Any) -> Optional[str]:
    """Nettoie un texte : espaces insécables, caractères invisibles, espaces multiples."""
    if value is None:
        return None
    try:
        text = str(value)
        text = text.replace("\xa0", " ")
        text = text.replace("\u200b", "")
        text = text.replace("\ufeff", "")
        text = unicodedata.normalize("NFKC", text)
        text = re.sub(r"[\t\r\n\f\v]+", " ", text)
        text = re.sub(r"\s{2,}", " ", text)
        text = text.strip()
        return text if text else None
    except Exception as exc:
        logger.debug(f"Erreur dans clean_text : {exc}")
        return None


def remove_accents(value: Optional[str]) -> str:
    """Supprime les accents pour les comparaisons ou parsing de dates."""
    if not value:
        return ""
    nfkd_form = unicodedata.normalize("NFD", str(value))
    return "".join(c for c in nfkd_form if unicodedata.category(c) != "Mn")


def safe_text(node: Any) -> Optional[str]:
    """Récupère le texte d'un nœud selectolax sans lever d'exception."""
    if node is None:
        return None
    try:
        return node.text(deep=True)
    except TypeError:
        try:
            return node.text()
        except Exception as exc:
            logger.debug(f"Impossible de récupérer le texte du nœud : {exc}")
            return None
    except Exception as exc:
        logger.debug(f"Impossible de récupérer le texte du nœud : {exc}")
        return None


def normalize_url(href: Optional[str]) -> Optional[str]:
    """Transforme un lien relatif en lien absolu et supprime le fragment"""
    if not href:
        return None

    href = href.strip()

    if href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return None

    try:
        absolute = urljoin(BASE_URL, href)
    except Exception as exc:
        logger.debug(f"URL impossible à normaliser '{href}' : {exc}")
        return None

    parsed = urlparse(absolute)

    if parsed.scheme not in {"http", "https"}:
        return None

    try:
        return urlunparse(parsed._replace(fragment=""))
    except Exception:
        return absolute


def is_probable_job_link(url: Optional[str]) -> bool:
    """Filtre les liens qui semblent être des pages de poste"""
    if not url:
        return False

    parsed = urlparse(url)
    netloc = parsed.netloc.lower().split(":")[0]

    if BASE_DOMAIN and netloc and not netloc.endswith(BASE_DOMAIN):
        return False

    path_and_query = f"{parsed.path} {parsed.query}".lower()
    return any(keyword in path_and_query for keyword in JOB_URL_KEYWORDS)


def save_json(data: Any, path: Path, description: str) -> None:
    """Sauvegarde JSON de manière atomique"""
    try:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        tmp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")

        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        shutil.move(str(tmp_path), str(path))

        count = len(data) if hasattr(data, "__len__") else "?"
        logger.success(f"{description} sauvegardé : {path} ({count} élément(s)).")
    except Exception as exc:
        logger.opt(exception=True).error(f"Échec de la sauvegarde JSON vers {path} : {exc}")


def close_safely(closeable: Any, name: str) -> None:
    """Ferme un objet Playwright sans lever d'exception"""
    if closeable is None:
        return

    try:
        closeable.close()
        logger.debug(f"{name} fermé correctement.")
    except Exception as exc:
        logger.debug(f"Erreur lors de la fermeture de {name} : {exc}")

# =============================================================================
# PLAYWRIGHT : NAVIGATION / ACTIONS
# =============================================================================

def block_resources(route: Route) -> None:
    """Bloque certaines ressources pour accélérer le scraping"""
    try:
        if route.request.resource_type in BLOCKED_RESOURCE_TYPES:
            route.abort()
        else:
            route.continue_()
    except Exception as exc:
        logger.debug(f"Erreur dans block_resources : {exc}")
        try:
            route.continue_()
        except Exception:
            pass


def apply_stealth(context: Any) -> None:
    """Applique playwright-stealth si disponible"""
    if STEALTH_MODE is None:
        logger.warning("playwright-stealth n'est pas installé. Continuation sans stealth.")
        return

    try:
        if STEALTH_MODE == "class":
            Stealth().apply_stealth_sync(context)
        elif STEALTH_MODE == "function" and _stealth_sync is not None:
            _stealth_sync(context)

        logger.info("Stealth appliqué au contexte Playwright.")
    except Exception as exc:
        logger.warning(f"Impossible d'appliquer playwright-stealth : {exc}")


def launch_browser(p: Any) -> Any:
    """Lance le navigateur Chromium avec des options anti-détection"""
    args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
    ]

    logger.info(f"Lancement du navigateur Chromium (headless={HEADLESS}).")

    return p.chromium.launch(
        headless=HEADLESS,
        args=args,
    )


def create_context(browser: Any) -> Any:
    """Crée un contexte navigateur avec timeouts et blocage de ressources"""
    context = browser.new_context(
        user_agent=USER_AGENT,
        locale="fr-FR",
        timezone_id="Europe/Paris",
        viewport={"width": 1366, "height": 768},
    )

    try:
        context.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
        context.set_default_timeout(ACTION_TIMEOUT_MS)
    except Exception as exc:
        logger.warning(f"Impossible de définir les timeouts par défaut : {exc}")

    try:
        context.route("**/*", block_resources)
    except Exception as exc:
        logger.warning(f"Impossible de mettre en place le blocage de ressources : {exc}")

    apply_stealth(context)

    return context


def goto_safe(page: Page, url: str, attempts: int = 3) -> bool:
    """Charge une URL avec retry"""
    if not url:
        logger.warning("goto_safe appelé avec une URL vide.")
        return False

    def _goto() -> bool:
        page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)

        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightError:
            logger.debug(f"networkidle non atteint pour {url}, continuation.")

        return True

    try:
        retry_sync(_goto, attempts=attempts, what=f"Chargement de {url}")
        return True
    except Exception as exc:
        logger.error(f"Échec de chargement de {url} : {exc}")
        return False


def wait_for_page_ready(page: Page) -> None:
    """Attend que la page soit suffisamment chargée"""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    except Exception:
        logger.debug("wait_for_load_state('domcontentloaded') a échoué ou timeout.")

    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        logger.debug("wait_for_load_state('networkidle') a échoué ou timeout.")


def safe_click_locator(
    locator: Locator,
    description: str,
    timeout_ms: int = ACTION_TIMEOUT_MS,
) -> bool:
    """Clique sur un locator de manière sécurisée"""
    try:
        if locator.count() == 0:
            logger.debug(f"{description} : aucun élément trouvé.")
            return False

        first = locator.first

        if not first.is_visible():
            logger.debug(f"{description} : élément présent mais invisible.")
            return False

        first.scroll_into_view_if_needed(timeout=timeout_ms)
        first.click(timeout=timeout_ms)

        logger.debug(f"{description} : clic réussi.")
        return True
    except Exception as exc:
        logger.debug(f"{description} : clic impossible -> {exc}")
        return False


def auto_scroll(page: Page, scrolls: int = 3) -> None:
    """Scrolle la page pour déclencher d'éventuels chargements paresseux"""
    try:
        for _ in range(scrolls):
            page.mouse.wheel(0, 1500)
            page.wait_for_timeout(300)

        page.evaluate("window.scrollTo(0, 0);")
    except Exception as exc:
        logger.debug(f"Scroll automatique impossible : {exc}")


def goto_next_page(page: Page, current_page_number: int) -> bool:
    """Essaie de naviguer vers la page suivante"""
    for selector in NEXT_PAGE_SELECTORS:
        try:
            locator = page.locator(selector)
            if safe_click_locator(locator, f"Pagination suivante (page {current_page_number + 1})"):
                wait_for_page_ready(page)
                human_wait(page, 1.5, 3.0)
                logger.info(f"Navigation vers la page {current_page_number + 1} réussie.")
                return True
        except Exception as exc:
            logger.debug(f"Sélecteur de pagination '{selector}' échoué : {exc}")

    logger.debug(f"Aucun bouton de pagination trouvé pour la page {current_page_number + 1}.")
    return False

# =============================================================================
# COLLECTE DES LIENS
# =============================================================================

def build_html_parser(page: Page) -> Optional[HTMLParser]:
    """Récupère le HTML de la page et construit un parser selectolax"""
    try:
        content = page.content()
        return HTMLParser(content)
    except Exception as exc:
        logger.opt(exception=True).error(f"Impossible de récupérer le HTML de la page : {exc}")
        return None


# =============================================================================
# FILTRE DE FRAÎCHEUR - JobIvoire
# =============================================================================

def parse_card_date(text: Optional[str]) -> Optional[datetime]:
    """
    Parse une date depuis le texte d'une carte JobIvoire.
    Gère :
      - "Aujourd'hui, 11:30"
      - "Hier, 09:40"
      - "Avant-hier, 23:30"
      - "15/08/2026"
      - "15/08/2026 16:50"
      - "15 août 2026"
      - "le 15/08/2026"
    """
    if not text:
        return None

    cleaned = clean_text(text)
    if not cleaned:
        return None

    normalized = remove_accents(cleaned).lower()
    now = datetime.now(timezone.utc)

    # "Aujourd'hui" (éventuellement suivi d'une heure)
    if "aujourd" in normalized:
        logger.debug(f"'Aujourd'hui' détecté dans '{text}'")
        return now

    # "Hier" (éventuellement suivi d'une heure)
    if "hier" in normalized and "avant-hier" not in normalized and "avant hier" not in normalized:
        logger.debug(f"'Hier' détecté dans '{text}'")
        return now - timedelta(days=1)

    # "Avant-hier" (éventuellement suivi d'une heure)
    if "avant-hier" in normalized or "avant hier" in normalized:
        logger.debug(f"'Avant-hier' détecté dans '{text}'")
        return now - timedelta(days=2)

    # Enlever l'heure éventuelle après une date numérique (ex: "14/08/2026 16:50" -> "14/08/2026")
    cleaned_no_time = re.sub(r"(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+\d{1,2}:\d{2}.*", r"\1", cleaned)

    # Format numérique FR : 15/08/2026, 15-08-2026
    match = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", cleaned_no_time)
    if match:
        day, month, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
            logger.debug(f"Date numérique parsée : {dt.date()} <- '{text}'")
            return dt
        except ValueError:
            logger.debug(f"Date numérique invalide : {day}/{month}/{year} <- '{text}'")
            return None

    # Format texte FR : 15 août 2026
    match = re.search(r"(\d{1,2})(?:er)?\s+([a-zûé]+)\s+(\d{4})", normalized)
    if match:
        day, month_text, year = match.groups()
        month_key = month_text[:3]
        month_text = MONTH_ALIASES.get(month_key, month_text)
        month = MOIS_FR.get(month_text)
        if month:
            try:
                dt = datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
                logger.debug(f"Date texte parsée : {dt.date()} <- '{text}'")
                return dt
            except ValueError:
                logger.debug(f"Date texte invalide : {day}/{month_text}/{year} <- '{text}'")
                return None

    logger.debug(f"Format de date non reconnu : '{text}' (nettoyé : '{cleaned}')")
    return None


def extract_card_published_date(card: Any) -> Optional[datetime]:
    """
    Extrait la date de publication depuis une carte JobIvoire.
    
    HTML typique :
        <div class="job-item-meta">
            <ul class="list-wrap fs-12">
                <li><i class="fas fa-map-marker-alt me-2"></i>ABIDJAN</li>
                <li><i class="far fa-clock me-2"></i>Publié : Aujourd'hui, 11:30</li>
            </ul>
        </div>
    Le dernier <li> contient la date de publication.
    """
    for selector in PUBLISHED_DATE_SELECTORS:
        try:
            nodes = card.css(selector)
            if not nodes:
                continue

            # Parcourir tous les <li> et chercher celui avec une date de publication
            for node in nodes:
                text = clean_text(safe_text(node))
                if not text:
                    continue

                normalized = remove_accents(text).lower()

                # Vérifier si ce <li> contient une date de publication
                # Patterns acceptés :
                #   - "publié" (avec ou sans "le")
                #   - "aujourd'hui", "hier", "avant-hier"
                #   - une date numérique DD/MM/YYYY
                has_date_pattern = (
                    "publi" in normalized
                    or "post" in normalized
                    or "aujourd" in normalized
                    or "hier" in normalized
                    or "avant-hier" in normalized
                    or "avant hier" in normalized
                    or re.search(r"\d{1,2}[/.-]\d{1,2}[/.-]\d{4}", text)
                )

                if has_date_pattern:
                    # Enlever les préfixes courants
                    # "Publié :" / "Publié le :" / "Publiée le :" / "Posté le :" etc.
                    text = re.sub(
                        r"^publi[ée]e?\s*:\s*(le\s*)?",
                        "",
                        text,
                        flags=re.IGNORECASE
                    ).strip()
                    text = re.sub(
                        r"^post[ée]e?\s*:\s*(le\s*)?",
                        "",
                        text,
                        flags=re.IGNORECASE
                    ).strip()
                    text = re.sub(
                        r"^mis\s+en\s+ligne\s*:\s*(le\s*)?",
                        "",
                        text,
                        flags=re.IGNORECASE
                    ).strip()

                    dt = parse_card_date(text)
                    if dt:
                        logger.debug(f"Date de publication extraite : {dt.date()} <- '{text}'")
                        return dt
        except Exception as exc:
            logger.debug(f"Erreur extraction date publication avec '{selector}' : {exc}")

    logger.debug("Date de publication non trouvée sur cette carte.")
    return None


def extract_card_expiration_date(card: Any) -> Optional[datetime]:
    """
    Extrait la date d'expiration depuis une carte JobIvoire.
    
    HTML typique :
        <div class="job-card-header">
            <div class="job-deadline text-danger">
                Dernier délai : 30/09/2026
            </div>
        </div>
    """
    for selector in EXPIRATION_DATE_SELECTORS:
        try:
            node = card.css_first(selector)
            if node is None:
                continue

            text = clean_text(safe_text(node))
            if not text:
                continue

            normalized = remove_accents(text).lower()

            if re.search(r"dernier\s*d[ée]lai|expir|limite|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}", normalized):
                # Enlever le préfixe "Dernier délai :" ou "Expire le"
                text = re.sub(r"^dernier\s*d[ée]lai\s*:\s*", "", text, flags=re.IGNORECASE).strip()
                text = re.sub(r"^expire?\s+le\s*", "", text, flags=re.IGNORECASE).strip()

                dt = parse_card_date(text)
                if dt:
                    logger.debug(f"Date d'expiration extraite : {dt.date()} <- '{text}'")
                    return dt
        except Exception as exc:
            logger.debug(f"Erreur extraction date expiration avec '{selector}' : {exc}")

    logger.debug("Date d'expiration non trouvée sur cette carte.")
    return None


def is_offer_fresh_and_active(
    card: Any,
    url: str,
    reference_date: Optional[datetime] = None,
) -> tuple[bool, str, bool]:
    """
    Vérifie si une offre est fraîche (publiée récemment) et toujours active (non expirée).
    
    Retourne un tuple (is_valid, reason, is_expired) où :
      - is_valid : True si l'offre doit être collectée
      - reason : description du résultat pour les logs
      - is_expired : True si l'offre est expirée (on continue), False si trop ancienne (on arrête)
    """
    now = reference_date or datetime.now(timezone.utc)
    today_date = now.date()

    logger.debug(f"[{url}] Vérification de fraîcheur (date de référence : {today_date})")

    # 1. Vérification de la date d'expiration
    if CHECK_EXPIRATION:
        expiration_dt = extract_card_expiration_date(card)

        if expiration_dt is not None:
            logger.debug(f"[{url}] Date d'expiration : {expiration_dt.date()}")
            if expiration_dt.date() < today_date:
                reason = f"offre expirée (expirée le {expiration_dt.date()})"
                return False, reason, True
            logger.debug(f"[{url}] Offre encore valide jusqu'au {expiration_dt.date()}.")

    # 2. Vérification de la date de publication
    published_dt = extract_card_published_date(card)

    if published_dt is None:
        logger.debug(f"[{url}] Date de publication introuvable, offre acceptée par défaut.")
        return True, "date non détectée, offre acceptée", False

    days_old = (today_date - published_dt.date()).days
    logger.debug(f"[{url}] Offre publiée il y a {days_old} jour(s) (le {published_dt.date()})")

    # Si MAX_DAYS_OLD < 0, on désactive le filtre de fraîcheur
    if MAX_DAYS_OLD >= 0 and days_old > MAX_DAYS_OLD:
        reason = f"offre trop ancienne (publiée il y a {days_old} jour(s), le {published_dt.date()})"
        return False, reason, False

    if days_old < 0:
        logger.debug(f"[{url}] Date de publication dans le futur ({published_dt.date()}), offre acceptée.")

    # Construire la raison de succès
    parts = []
    if published_dt:
        parts.append(f"publiée le {published_dt.date()}")
    if CHECK_EXPIRATION:
        expiration_dt = extract_card_expiration_date(card)
        if expiration_dt:
            parts.append(f"expire le {expiration_dt.date()}")

    reason = ", ".join(parts) if parts else "offre valide"
    return True, reason, False


def extract_links_from_current_page(page: Page) -> tuple[list[str], list[str], bool]:
    """
    Extrait les liens de la page courante avec filtrage de fraîcheur.
    
    Retourne un tuple :
      - fresh_links : offres fraîches (récentes et non expirées)
      - fallback_links : tous les liens valides (pour le fallback si aucune offre fraîche)
      - stop_signal : True si une offre TROP ANCIENNE a été rencontrée
                      (signale qu'il faut arrêter la pagination)
    """
    html = build_html_parser(page)

    if html is None:
        return [], [], False

    fresh_links: list[str] = []
    fallback_links: list[str] = []
    seen_local: set[str] = set()
    stop_signal = False

    stats = {
        "total_cards": 0,
        "fresh": 0,
        "rejected_too_old": 0,
        "rejected_expired": 0,
        "rejected_no_link": 0,
    }

    # Récupérer les cartes
    cards = []
    for card_selector in CARD_SELECTORS:
        try:
            cards = html.css(card_selector)
            if cards:
                logger.debug(f"Cartes trouvées avec le sélecteur '{card_selector}' : {len(cards)}")
                break
        except Exception as exc:
            logger.debug(f"Sélecteur de carte invalide '{card_selector}' : {exc}")
            continue

    if not cards:
        logger.warning("Aucune carte d'offre trouvée sur cette page.")
        return [], [], False

    stats["total_cards"] = len(cards)

    # Parcourir chaque carte
    for card_index, card in enumerate(cards, start=1):
        # --- Extraction du lien ---
        href = None

        for link_selector in CARD_LINK_SELECTORS:
            try:
                a_tag = card.css_first(link_selector)
                if a_tag is None:
                    continue
                attributes = getattr(a_tag, "attributes", None) or {}
                href = attributes.get("href")
                if href:
                    break
            except Exception:
                continue

        url = normalize_url(href)
        if not url:
            stats["rejected_no_link"] += 1
            logger.debug(f"Carte {card_index} : lien invalide ou absent")
            continue

        # --- On ajoute TOUJOURS le lien au fallback ---
        if url not in seen_local:
            seen_local.add(url)
            fallback_links.append(url)

        # --- Vérification de fraîcheur et d'expiration ---
        is_valid, reason, is_expired = is_offer_fresh_and_active(card, url)

        if not is_valid:
            if is_expired:
                # Offre expirée : on continue (on passe au suivant)
                stats["rejected_expired"] += 1
                logger.info(f"⏭️  Offre expirée [{url}] : {reason} -> on continue")
                continue
            else:
                # Offre trop ancienne : on arrête
                stats["rejected_too_old"] += 1
                logger.info(f"🛑 Offre trop ancienne [{url}] : {reason}")
                logger.info("   -> ARRÊT IMMÉDIAT de la collecte sur cette page")
                stop_signal = True
                break

        # --- Offre fraîche : on l'ajoute ---
        if url not in fresh_links:
            fresh_links.append(url)
            stats["fresh"] += 1
            logger.info(f"✅ Offre fraîche acceptée [{url}] : {reason}")

    # Log récapitulatif
    logger.info(
        f"📊 Filtrage page terminé : "
        f"{stats['fresh']} fraîche(s) | "
        f"{stats['rejected_too_old']} trop ancienne(s) | "
        f"{stats['rejected_expired']} expirée(s) | "
        f"{stats['rejected_no_link']} sans lien "
        f"(sur {stats['total_cards']} carte(s) analysée(s))"
    )

    if stop_signal:
        logger.warning("🛑 SIGNAL D'ARRÊT ÉMIS : une offre trop ancienne a été rencontrée.")

    return fresh_links, fallback_links, stop_signal


def collect_all_job_links(page: Page) -> list[str]:
    """
    Collecte les liens de postes sur plusieurs pages.
    
    Logique :
      - Si on rencontre une offre EXPIRÉE → on continue (on passe au suivant)
      - Si on rencontre une offre TROP ANCIENNE → arrêt immédiat
      - Si à la fin on a au moins 1 offre fraîche → on les retourne
      - Si on a 0 offre fraîche → fallback sur les 10 premières offres (sans filtre)
    """
    fresh_links: list[str] = []
    all_fallback_links: list[str] = []
    seen_fresh: set[str] = set()
    seen_fallback: set[str] = set()

    current_page_number = 1
    max_pages = max(1, MAX_PAGES)

    logger.info(
        f"Filtre de fraîcheur actif : MAX_DAYS_OLD={MAX_DAYS_OLD}, "
        f"CHECK_EXPIRATION={CHECK_EXPIRATION}"
    )

    while current_page_number <= max_pages:
        logger.info(f"Collecte des liens sur la page {current_page_number}.")

        wait_for_page_ready(page)
        auto_scroll(page)

        page_fresh, page_fallback, stop_signal = extract_links_from_current_page(page)

        # Ajoute les offres fraîches (dédupliquées)
        new_fresh = [link for link in page_fresh if link not in seen_fresh]
        if new_fresh:
            seen_fresh.update(new_fresh)
            fresh_links.extend(new_fresh)

        # Ajoute les offres de fallback (dédupliquées)
        new_fallback = [link for link in page_fallback if link not in seen_fallback]
        if new_fallback:
            seen_fallback.update(new_fallback)
            all_fallback_links.extend(new_fallback)

        logger.info(
            f"Page {current_page_number} : "
            f"{len(page_fresh)} fraîche(s), "
            f"{len(page_fallback)} totale(s), "
            f"total fraîches collectées : {len(fresh_links)}."
        )

        # --- Cas 1 : arrêt demandé (offre trop ancienne rencontrée) ---
        if stop_signal:
            logger.info(
                "Arrêt de la pagination : une offre trop ancienne a été rencontrée. "
                f"On conserve les {len(fresh_links)} offre(s) fraîche(s) déjà collectée(s)."
            )
            break

        # --- Cas 2 : aucune nouvelle offre fraîche et page > 1 ---
        if not new_fresh and current_page_number > 1:
            logger.info("Aucune nouvelle offre fraîche sur cette page. Arrêt de la pagination.")
            break

        # --- Cas 3 : nombre max de pages atteint ---
        if current_page_number >= max_pages:
            logger.info("Nombre maximum de pages atteint.")
            break

        # --- Pagination ---
        if not goto_next_page(page, current_page_number):
            logger.info("Fin de la pagination.")
            break

        current_page_number += 1

    # ============================================================
    # DÉCISION FINALE
    # ============================================================

    if fresh_links:
        logger.info(
            f"✅ Collecte terminée avec {len(fresh_links)} offre(s) fraîche(s)."
        )
        return fresh_links

    # Aucune offre fraîche → fallback
    fallback_count = min(10, len(all_fallback_links))
    logger.warning(
        f"⚠️ Aucune offre fraîche trouvée. "
        f"Fallback : récupération des {fallback_count} première(s) offre(s) "
        f"sans tenir compte de la date."
    )
    return all_fallback_links[:10]

    
# =============================================================================
# TRAITEMENT DES OFFRES
# =============================================================================

def scrape_job_links(page: Page, links: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parcourt chaque lien de poste et extrait les données"""
    jobs: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    total = len(links)

    for index, link in enumerate(links, start=1):
        logger.info(f"[{index}/{total}] Traitement du poste : {link}")

        try:
            if not goto_safe(page, link):
                failures.append(
                    {
                        "url": link,
                        "erreur": "Navigation impossible ou page non chargée.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            human_wait(page, 2.0, 4.0)

            html = build_html_parser(page)

            if html is None:
                failures.append(
                    {
                        "url": link,
                        "erreur": "HTML de la page inaccessible.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            # Parse l'offre avec extract_offer
            try:
                job = parse_job_html(html, link)
            except Exception as parse_exc:
                logger.opt(exception=True).error(
                    f"[{index}/{total}] Erreur lors du parsing de {link} : {parse_exc}"
                )
                failures.append(
                    {
                        "url": link,
                        "erreur": f"Erreur de parsing : {parse_exc}",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            if job and (job.get("title") or job.get("description")):
                jobs.append(job)
                save_json(jobs, OUTPUT_FILE, "Données des jobs")
                logger.success(f"[{index}/{total}] Données extraites avec succès pour {link}.")
            else:
                failures.append(
                    {
                        "url": link,
                        "erreur": "Aucune donnée pertinente trouvée.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                logger.warning(f"[{index}/{total}] Aucune donnée pertinente pour {link}.")

        except Exception as exc:
            logger.opt(exception=True).error(
                f"[{index}/{total}] Erreur inattendue pendant l'extraction de {link} : {exc}"
            )

            failures.append(
                {
                    "url": link,
                    "erreur": str(exc),
                    "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }
            )

        finally:
            human_wait(page, 1.0, 2.5)

    return jobs, failures

# =============================================================================
# FONCTION PRINCIPALE
# =============================================================================

def main() -> int:
    setup_logger()

    logger.info("=" * 80)
    logger.info("Démarrage du scraper JobIvoire")
    logger.info("=" * 80)
    logger.info(
        f"Configuration : BASE_URL={BASE_URL} | "
        f"MAX_PAGES={MAX_PAGES} | MAX_JOBS={MAX_JOBS} | HEADLESS={HEADLESS}"
    )

    if not BASE_URL.startswith(("http://", "https://")):
        logger.critical(f"BASE_URL invalide : '{BASE_URL}'.")
        return 2

    jobs: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    exit_code = 0

    try:
        with sync_playwright() as p:
            browser = None
            context = None
            page = None

            try:
                browser = launch_browser(p)
                context = create_context(browser)
                page = context.new_page()

                if not goto_safe(page, BASE_URL):
                    logger.critical(f"Impossible de charger la page de base : {BASE_URL}")
                    exit_code = 1
                else:
                    human_wait(page, 1.5, 3.0)

                    links = collect_all_job_links(page)

                    if not links:
                        logger.warning("Aucun lien de poste n'a pu être collecté.")

                    if MAX_JOBS > 0:
                        logger.info(f"Limitation du traitement à {MAX_JOBS} lien(s).")
                        links = links[:MAX_JOBS]

                    jobs, failures = scrape_job_links(page, links)

            except KeyboardInterrupt:
                logger.warning("Interruption manuelle du script. Sauvegarde des données partielles.")
                exit_code = 130

            except Exception as exc:
                logger.opt(exception=True).critical(f"Erreur globale pendant le scraping : {exc}")
                exit_code = 1

            finally:
                save_json(jobs, OUTPUT_FILE, "Données des jobs")
                save_json(failures, FAILED_FILE, "Échecs de scraping")

                if jobs:
                    try:
                        maybe_send_jobs_to_api("jobivoire", jobs, run_reference="jobivoire:script", logger=logger)
                    except Exception as exc:
                        logger.opt(exception=True).error(f"Envoi API impossible pour JobIvoire : {exc}")
                        if exit_code == 0:
                            exit_code = 1

                close_safely(page, "page")
                close_safely(context, "contexte")
                close_safely(browser, "navigateur")

    except Exception as exc:
        logger.opt(exception=True).critical(f"Impossible d'initialiser Playwright : {exc}")
        return 1

    logger.info("=" * 80)
    logger.info(
        f"Scraping terminé. Succès : {len(jobs)} | Échecs : {len(failures)}."
    )
    logger.info("=" * 80)

    if failures and not jobs and exit_code == 0:
        exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
