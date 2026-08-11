from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from db.session import session_scope
from models.enums import JobOfferOrigin, JobOfferStatus, SourceStatus
from models.jobs import Company, JobOffer, JobOfferDetail, OfferFiliere
from models.referentials import (
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    FiliereKeyword,
    FiliereSpecialty,
    Location,
    Source,
)
from models.content import ContentPage
from models.editorial import (
    Article,
    ArticleCategory,
    ArticleKeyFigure,
    ArticleSection,
    ArticleSectionBlock,
    ArticleSeries,
    ArticleTakeaway,
    DailyTip,
    SeriesArticle,
)
from models.enums import ContentStatus, ContentType

EDITORIAL_SEED_ENABLED = True

from services.normalization import normalize_text, slugify


SOURCES = [
    {
        "code": "emploi-dakar",
        "name": "EmploiDakar CI",
        "base_url": "https://www.emploidakar.com",
        "jobs_url": "https://www.emploidakar.com/offres",
        "logo_path": "/static/sources/emploidakar-ci.png",
        "color_hex": "#0F2D4D",
        "short_code": "ED",
        "priority": 10,
        "anti_scraping_level": 1,
        "default_scan_time": "06:00",
        "description": "Portail généraliste d'offres d'emploi pour la Côte d'Ivoire.",
        "notes": "Source principale : structure HTML à surveiller.",
        "is_primary": True,
        "supports_scraping": True,
    },
    {
        "code": "goafrica",
        "name": "Go Africa Online",
        "base_url": "https://www.goafricaonline.com",
        "jobs_url": "https://www.goafricaonline.com/offres",
        "logo_path": "/static/sources/goafrica.png",
        "color_hex": "#1D4ED8",
        "short_code": "GA",
        "priority": 20,
        "anti_scraping_level": 1,
        "default_scan_time": "06:10",
        "description": "Site emploi à couverture régionale africaine.",
        "notes": "Contrôler la pagination et les libellés de filière.",
        "is_primary": False,
        "supports_scraping": True,
    },
    {
        "code": "novojob",
        "name": "Novojob",
        "base_url": "https://www.novojob.com",
        "jobs_url": "https://www.novojob.com/offres",
        "logo_path": "/static/sources/novojob.png",
        "color_hex": "#16A34A",
        "short_code": "NJ",
        "priority": 30,
        "anti_scraping_level": 2,
        "default_scan_time": "06:20",
        "description": "Plateforme emploi locale ivoirienne.",
        "notes": "Source locale pertinente pour les offres PME.",
        "is_primary": False,
        "supports_scraping": True,
    },
    {
        "code": "linkedin",
        "name": "LinkedIn",
        "base_url": "https://www.linkedin.com",
        "jobs_url": "https://www.linkedin.com/jobs",
        "logo_path": "/static/sources/linkedin.png",
        "color_hex": "#0A66C2",
        "short_code": "IN",
        "priority": 40,
        "anti_scraping_level": 4,
        "default_scan_time": "06:30",
        "description": "Réseau professionnel international.",
        "notes": "Protections anti-scraping fortes : délais et plan de repli requis.",
        "is_primary": False,
        "supports_scraping": True,
    },
]


FILIERES = [
    (
        "tech-dev",
        "Tech & Dev",
        "sky",
        "code",
        ["developpeur", "python", "react", "data", "cloud", "full stack", "devops"],
    ),
    (
        "marketing-com",
        "Marketing & Communication",
        "fuchsia",
        "megaphone",
        [
            "marketing",
            "communication",
            "community manager",
            "contenu",
            "brand",
            "digital",
        ],
    ),
    (
        "commercial-vente",
        "Commercial & Vente",
        "orange",
        "trending-up",
        [
            "commercial",
            "vente",
            "business developer",
            "grands comptes",
            "account manager",
        ],
    ),
    (
        "comptabilite-finance",
        "Comptabilité & Finance",
        "emerald",
        "calculator",
        ["comptable", "finance", "audit", "contrôle de gestion", "trésorerie"],
    ),
    (
        "ressources-humaines",
        "Ressources Humaines",
        "violet",
        "users",
        ["rh", "recrutement", "paie", "formation", "talents"],
    ),
    (
        "btp-genie-civil",
        "BTP & Génie Civil",
        "amber",
        "hard-hat",
        ["btp", "genie civil", "chantier", "conducteur de travaux", "structure"],
    ),
    (
        "logistique-transport",
        "Logistique & Transport",
        "cyan",
        "truck",
        ["logistique", "transport", "supply chain", "stock", "entrepôt"],
    ),
    (
        "sante-medical",
        "Santé & Médical",
        "rose",
        "stethoscope",
        ["sante", "medical", "infirmier", "clinique", "laboratoire"],
    ),
    (
        "administration",
        "Administration",
        "slate",
        "briefcase",
        ["assistant", "administratif", "office", "secrétariat", "back office"],
    ),
    (
        "education-formation",
        "Éducation & Formation",
        "lime",
        "graduation-cap",
        ["enseignant", "formation", "pedagogie", "formateur", "éducation"],
    ),
    (
        "hotellerie-restauration",
        "Hôtellerie & Restauration",
        "red",
        "chef-hat",
        ["hotel", "restaurant", "cuisine", "réception", "salle"],
    ),
    (
        "agriculture-agrobusiness",
        "Agriculture & Agrobusiness",
        "green",
        "leaf",
        ["agriculture", "agro", "elevage", "agronome", "exploitation"],
    ),
    (
        "securite-gardiennage",
        "Sécurité & Gardiennage",
        "zinc",
        "shield",
        ["securite", "gardiennage", "hse", "sûreté", "prévention"],
    ),
]

KEYWORDS_BY_FILIERE = {item[0]: item[4] for item in FILIERES}

ARTICLE_CATEGORIES = [
    {
        "code": "cv-lettres",
        "label": "CV & Lettres",
        "slug": "cv-lettres",
        "hue": "sky",
        "icon_name": "file-text",
        "sort_order": 1,
    },
    {
        "code": "entretiens",
        "label": "Entretiens",
        "slug": "entretiens",
        "hue": "orange",
        "icon_name": "message-circle",
        "sort_order": 2,
    },
    {
        "code": "competences",
        "label": "Compétences",
        "slug": "competences",
        "hue": "emerald",
        "icon_name": "award",
        "sort_order": 3,
    },
    {
        "code": "tendances-marche",
        "label": "Marché de l'emploi",
        "slug": "marche-emploi",
        "hue": "fuchsia",
        "icon_name": "line-chart",
        "sort_order": 4,
    },
    {
        "code": "secteurs",
        "label": "Secteurs qui recrutent",
        "slug": "secteurs",
        "hue": "cyan",
        "icon_name": "building-2",
        "sort_order": 5,
    },
    {
        "code": "outils-numeriques",
        "label": "Outils numériques",
        "slug": "outils-numeriques",
        "hue": "violet",
        "icon_name": "laptop",
        "sort_order": 6,
    },
]


DAILY_TIPS = [
    {
        "rotation_order": 0,
        "category_code": "cv-lettres",
        "text": (
            "Personnalisez votre CV pour chaque offre. Reprenez les mots-clés "
            "de l'annonce et montrez que vous comprenez le besoin du recruteur."
        ),
    },
    {
        "rotation_order": 1,
        "category_code": "cv-lettres",
        "text": (
            "Ajoutez des résultats chiffrés : chiffre d'affaires, volume traité, "
            "délais réduits, clients accompagnés, objectifs atteints."
        ),
    },
    {
        "rotation_order": 2,
        "category_code": "entretiens",
        "text": (
            "Préparez 3 questions à poser au recruteur. Cela montre votre intérêt "
            "pour le poste, l'équipe et les objectifs."
        ),
    },
    {
        "rotation_order": 3,
        "category_code": "entretiens",
        "text": (
            "Après un entretien, envoyez un message de remerciement court et poli "
            "dans les 24 à 48 heures."
        ),
    },
    {
        "rotation_order": 4,
        "category_code": "tendances-marche",
        "text": (
            "Activez des alertes sur les filières qui vous intéressent. Vous serez "
            "plus réactif que les candidats qui consultent les sites manuellement."
        ),
    },
    {
        "rotation_order": 5,
        "category_code": "outils-numeriques",
        "text": (
            "Mettez à jour votre profil LinkedIn avec un titre clair, un résumé "
            "professionnel et des compétences liées aux offres visées."
        ),
    },
    {
        "rotation_order": 6,
        "category_code": "secteurs",
        "text": (
            "Ciblez les entreprises des secteurs porteurs : logistique, agro-industrie, "
            "santé, tech, commerce et services."
        ),
    },
]


ARTICLES_SEED = [
    {
        "slug": "rediger-un-cv-percutant-en-cote-divoire",
        "title": "Rédiger un CV percutant en Côte d'Ivoire",
        "category_code": "cv-lettres",
        "meta_description": (
            "Structure, mots-clés, résultats chiffrés et erreurs à éviter pour créer "
            "un CV adapté au marché ivoirien."
        ),
        "image_url": "/media/articles/cv-percutant.jpg",
        "reading_minutes": 6,
        "view_count": 240,
        "is_featured": True,
        "featured_order": 1,
        "quote_text": "Un bon CV ne liste pas des tâches : il prouve une valeur.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["CV", "candidature", "recrutement", "Côte d'Ivoire"],
        "intro": (
            "Sur le marché de l'emploi en Côte d'Ivoire, les recruteurs reçoivent souvent "
            "un grand nombre de candidatures pour une seule offre. Votre CV doit donc être "
            "clair, orienté résultats et adapté au poste visé dès les premières secondes de lecture."
        ),
        "sections": [
            {
                "anchor": "structure-claire",
                "title": "Une structure claire dès la première lecture",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Un CV efficace doit permettre au recruteur de comprendre votre profil "
                            "en moins de dix secondes. Mettez en avant votre titre professionnel, "
                            "vos expériences clés et vos compétences principales en haut de page."
                        ),
                    },
                    {
                        "block_type": "list",
                        "content": (
                            "- Titre professionnel précis\n"
                            "- Résumé de 3 à 5 lignes\n"
                            "- Expériences avec résultats chiffrés\n"
                            "- Compétences techniques et comportementales\n"
                            "- Formation et certifications"
                        ),
                    },
                ],
            },
            {
                "anchor": "mots-cles",
                "title": "Des mots-clés alignés sur l'offre",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Beaucoup d'offres utilisent des mots-clés spécifiques : gestion de projet, "
                            "développement commercial, logistique, comptabilité, Python, gestion de stock, etc. "
                            "Reprenez ces termes dans votre CV si vous possédez réellement les compétences demandées."
                        ),
                    },
                    {
                        "block_type": "callout",
                        "content": (
                            "Astuce : comparez votre CV à l'offre et vérifiez que les compétences principales "
                            "de l'annonce apparaissent clairement dans votre profil."
                        ),
                    },
                ],
            },
            {
                "anchor": "erreurs-a-eviter",
                "title": "Les erreurs qui écartent un CV",
                "blocks": [
                    {
                        "block_type": "list",
                        "content": (
                            "- Fautes d'orthographe ou de grammaire\n"
                            "- CV trop long ou trop dense\n"
                            "- Description vague des expériences\n"
                            "- Adresse email peu professionnelle\n"
                            "- Mensonges sur les compétences ou les diplômes"
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Adaptez votre CV à chaque offre.",
            "Ajoutez des résultats mesurables.",
            "Facilitez la lecture pour le recruteur.",
        ],
        "key_figures": [
            {
                "value": 6,
                "label": "temps moyen passé par recruteur sur un CV",
                "suffix": "s",
            },
            {
                "value": 2,
                "label": "longueur maximale recommandée pour un CV",
                "suffix": "pages",
            },
            {
                "value": 30,
                "label": "des candidatures écartées par manque de clarté",
                "suffix": "%",
            },
        ],
    },
    {
        "slug": "preparer-un-entretien-d-embauche",
        "title": "Préparer un entretien d'embauche sans stress",
        "category_code": "entretiens",
        "meta_description": (
            "Méthode simple pour préparer un entretien d'embauche : présentation, réponses, "
            "questions à poser et relance après entretien."
        ),
        "image_url": "/media/articles/entretien-embauche.jpg",
        "reading_minutes": 7,
        "view_count": 190,
        "is_featured": True,
        "featured_order": 2,
        "quote_text": "Un entretien réussi est une conversation préparée.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["entretien", "recrutement", "oral", "préparation"],
        "intro": (
            "L'entretien d'embauche est l'étape où vous transformez votre candidature en opportunité. "
            "Une bonne préparation vous permet de répondre avec précision, de montrer votre motivation "
            "et de rassurer le recruteur sur votre capacité à réussir dans le poste."
        ),
        "sections": [
            {
                "anchor": "connaitre-entreprise",
                "title": "Connaître l'entreprise et le poste",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Avant l'entretien, prenez le temps de comprendre l'activité de l'entreprise, "
                            "ses clients, ses produits ou services, ses défis actuels et le contexte du recrutement. "
                            "Cette préparation vous aidera à poser des questions pertinentes."
                        ),
                    },
                    {
                        "block_type": "list",
                        "content": (
                            "- Secteur d'activité\n"
                            "- Taille de l'entreprise\n"
                            "- Produits ou services principaux\n"
                            "- Valeurs et culture\n"
                            "- Enjeux du poste"
                        ),
                    },
                ],
            },
            {
                "anchor": "pitch-personnel",
                "title": "Préparer une présentation courte",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "La question « Présentez-vous » revient presque toujours. Préparez une réponse "
                            "de 60 à 90 secondes qui résume votre parcours, vos compétences fortes et votre "
                            "intérêt pour le poste."
                        ),
                    },
                    {
                        "block_type": "callout",
                        "content": (
                            "Structure conseillée : qui vous êtes, ce que vous avez accompli, "
                            "ce que vous pouvez apporter à l'entreprise."
                        ),
                    },
                ],
            },
            {
                "anchor": "relance-apres-entretien",
                "title": "Relancer poliment après l'entretien",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Une relance courte et professionnelle peut faire la différence. Remerciez le recruteur, "
                            "réaffirmez votre motivation et demandez la suite du processus."
                        ),
                    },
                    {
                        "block_type": "list",
                        "content": (
                            "- Remerciement\n"
                            "- Rappel de votre intérêt\n"
                            "- Disponibilité pour la suite\n"
                            "- Ton poli et professionnel"
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Préparez votre présentation personnelle.",
            "Connaissez l'entreprise et le poste.",
            "Envoyez une relance professionnelle.",
        ],
        "key_figures": [
            {
                "value": 90,
                "label": "secondes pour faire une bonne première impression",
                "suffix": "s",
            },
            {
                "value": 3,
                "label": "questions à préparer pour le recruteur",
            },
            {
                "value": 48,
                "label": "heures maximales conseillées pour une relance",
                "suffix": "h",
            },
        ],
    },
    {
        "slug": "competences-recherchees-2026",
        "title": "Les compétences les plus recherchées en 2026",
        "category_code": "competences",
        "meta_description": (
            "Compétences techniques, comportementales et numériques à développer pour augmenter "
            "ses chances sur le marché de l'emploi en Côte d'Ivoire."
        ),
        "image_url": "/media/articles/competences-2026.jpg",
        "reading_minutes": 5,
        "view_count": 170,
        "is_featured": True,
        "featured_order": 3,
        "quote_text": "Les diplômes ouvrent des portes, les compétences les maintiennent ouvertes.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["compétences", "formation", "employabilité"],
        "intro": (
            "Le marché de l'emploi évolue rapidement. Les entreprises recherchent des profils capables "
            "de s'adapter, d'apprendre vite et de produire des résultats concrets. Développer les bonnes "
            "compétences peut fortement augmenter votre employabilité."
        ),
        "sections": [
            {
                "anchor": "competences-techniques",
                "title": "Les compétences techniques recherchées",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Les compétences techniques restent essentielles dans les secteurs comme la tech, "
                            "la logistique, la finance, le BTP ou la santé. Elles doivent être démontrées par "
                            "des projets, des certifications ou des résultats concrets."
                        ),
                    },
                    {
                        "block_type": "list",
                        "content": (
                            "- Analyse de données\n"
                            "- Gestion de projet\n"
                            "- Comptabilité et finance\n"
                            "- Logistique et supply chain\n"
                            "- Développement web\n"
                            "- Maintenance industrielle"
                        ),
                    },
                ],
            },
            {
                "anchor": "competences-comportementales",
                "title": "Les compétences comportementales",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Les soft skills sont de plus en plus importantes : communication, esprit d'équipe, "
                            "rigueur, autonomie et capacité à résoudre des problèmes. Elles font souvent la "
                            "différence entre deux profils similaires."
                        ),
                    },
                    {
                        "block_type": "callout",
                        "content": (
                            "En entretien, illustrez vos soft skills avec des exemples concrets plutôt que "
                            "de simplement les lister."
                        ),
                    },
                ],
            },
            {
                "anchor": "apprendre-vite",
                "title": "Apprendre vite",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "La capacité à apprendre vite devient une compétence clé. Les entreprises cherchent "
                            "des candidats capables de s'adapter aux nouveaux outils, aux nouvelles méthodes "
                            "et aux évolutions du marché."
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Développez des compétences concrètes.",
            "Montrez vos résultats avec des exemples.",
            "Renforcez vos compétences comportementales.",
        ],
        "key_figures": [
            {
                "value": 65,
                "label": "des recruteurs accordent de l'importance aux compétences pratiques",
                "suffix": "%",
            },
            {
                "value": 5,
                "label": "compétences clés à mettre en avant sur un CV",
            },
            {
                "value": 80,
                "label": "des employeurs valorisent la capacité d'adaptation",
                "suffix": "%",
            },
        ],
    },
    {
        "slug": "tendances-marche-emploi-ivoirien",
        "title": "Tendances du marché de l'emploi ivoirien",
        "category_code": "tendances-marche",
        "meta_description": (
            "Analyse simple des tendances du marché de l'emploi en Côte d'Ivoire : digitalisation, "
            "PME, logistique, agro-industrie et services."
        ),
        "image_url": "/media/articles/tendances-marche.jpg",
        "reading_minutes": 6,
        "view_count": 150,
        "is_featured": False,
        "featured_order": None,
        "quote_text": "Observer le marché permet de mieux cibler ses candidatures.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["marché", "emploi", "Côte d'Ivoire", "tendances"],
        "intro": (
            "Le marché de l'emploi ivoirien est dynamique mais sélectif. Les opportunités se développent "
            "dans plusieurs secteurs, notamment la logistique, le numérique, l'agro-industrie, la santé, "
            "le commerce et les services."
        ),
        "sections": [
            {
                "anchor": "digitalisation",
                "title": "La digitalisation des entreprises",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Les entreprises ivoiriennes accélèrent leur transformation digitale. Elles "
                            "recherchent des profils capables de gérer des outils numériques, d'améliorer "
                            "les processus et de contribuer à la performance opérationnelle."
                        ),
                    },
                ],
            },
            {
                "anchor": "pme",
                "title": "Le rôle central des PME",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Les PME restent un moteur important de l'emploi. Elles recherchent souvent des "
                            "profils polyvalents, capables de gérer plusieurs responsabilités et de s'adapter "
                            "rapidement à un environnement changeant."
                        ),
                    },
                ],
            },
            {
                "anchor": "logistique",
                "title": "La logistique comme secteur stratégique",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Avec les ports, les zones industrielles et la distribution, la logistique demeure "
                            "un secteur stratégique en Côte d'Ivoire. Les profils en transport, supply chain, "
                            "gestion de stock et coordination restent très recherchés."
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Suivez les secteurs qui recrutent.",
            "Adaptez vos compétences aux besoins du marché.",
            "Ciblez les PME et les entreprises en croissance.",
        ],
        "key_figures": [
            {
                "value": 4,
                "label": "sources d'emploi suivies par JobAlert CI",
            },
            {
                "value": 8,
                "label": "filières métiers principales du marché",
            },
            {
                "value": 30,
                "label": "jours de fenêtre pour identifier les tendances récentes",
                "suffix": "j",
            },
        ],
    },
    {
        "slug": "secteurs-qui-recrutent-en-cote-divoire",
        "title": "Les secteurs qui recrutent en Côte d'Ivoire",
        "category_code": "secteurs",
        "meta_description": (
            "Découvrez les secteurs porteurs en Côte d'Ivoire : agro-industrie, logistique, tech, santé, "
            "commerce, BTP et services."
        ),
        "image_url": "/media/articles/secteurs-recrutement.jpg",
        "reading_minutes": 6,
        "view_count": 180,
        "is_featured": False,
        "featured_order": None,
        "quote_text": "Un bon ciblage sectoriel augmente fortement vos chances.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["secteurs", "recrutement", "opportunités"],
        "intro": (
            "Tous les secteurs ne recrutent pas au même rythme. Pour optimiser votre recherche d'emploi, "
            "il est utile de connaître les domaines où les besoins sont les plus fréquents."
        ),
        "sections": [
            {
                "anchor": "agro-industrie",
                "title": "Agro-industrie et agriculture",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "La Côte d'Ivoire dispose d'un secteur agricole majeur. Les entreprises recherchent "
                            "des profils en production, qualité, maintenance, logistique, commercialisation "
                            "et gestion d'exploitation."
                        ),
                    },
                ],
            },
            {
                "anchor": "logistique-transport",
                "title": "Logistique et transport",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Le commerce, les ports et les zones industrielles créent des besoins réguliers "
                            "en logistique, transport, approvisionnement, planification et gestion d'entrepôt."
                        ),
                    },
                ],
            },
            {
                "anchor": "tech-services",
                "title": "Tech, digital et services",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Les entreprises recherchent aussi des profils tech, commerciaux, marketing, "
                            "administratifs et financiers. La capacité à utiliser les outils numériques est "
                            "un avantage important."
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Identifiez les secteurs porteurs.",
            "Adaptez votre CV au secteur visé.",
            "Suivez les offres régulièrement.",
        ],
        "key_figures": [
            {
                "value": 5,
                "label": "secteurs régulièrement suivis par les candidats",
            },
            {
                "value": 2,
                "label": "sources d'offres à comparer chaque semaine",
            },
            {
                "value": 10,
                "label": "candidatures ciblées valent mieux que 50 candidatures génériques",
            },
        ],
    },
    {
        "slug": "optimiser-son-profil-linkedin",
        "title": "Optimiser son profil LinkedIn pour être repéré",
        "category_code": "outils-numeriques",
        "meta_description": (
            "Comment optimiser son profil LinkedIn : titre, résumé, compétences, expériences et activité "
            "pour être visible des recruteurs."
        ),
        "image_url": "/media/articles/profil-linkedin.jpg",
        "reading_minutes": 5,
        "view_count": 160,
        "is_featured": False,
        "featured_order": None,
        "quote_text": "Votre profil LinkedIn est votre CV permanent.",
        "quote_author": "Équipe JobAlert CI",
        "tags": ["LinkedIn", "réseau", "visibilité", "digital"],
        "intro": (
            "LinkedIn est devenu un outil important pour la recherche d'emploi en Afrique de l'Ouest. "
            "Un profil clair, complet et actif peut attirer des recruteurs même quand vous ne postulez pas directement."
        ),
        "sections": [
            {
                "anchor": "titre-professionnel",
                "title": "Un titre professionnel clair",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Votre titre doit décrire précisément votre métier et vos compétences principales. "
                            "Évitez les titres trop vagues comme « disponible » ou « à l'écoute d'opportunités »."
                        ),
                    },
                    {
                        "block_type": "list",
                        "content": (
                            "- Comptable | Finance | Reporting\n"
                            "- Développeur Full Stack | Python | React\n"
                            "- Responsable Logistique | Supply Chain | Stock\n"
                            "- Chargé de Recrutement | RH | Talents"
                        ),
                    },
                ],
            },
            {
                "anchor": "resume",
                "title": "Un résumé orienté valeur",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Le résumé doit expliquer en quelques lignes ce que vous savez faire, les contextes "
                            "dans lesquels vous avez travaillé et les résultats que vous pouvez apporter."
                        ),
                    },
                ],
            },
            {
                "anchor": "activite",
                "title": "Une activité régulière",
                "blocks": [
                    {
                        "block_type": "paragraph",
                        "content": (
                            "Commenter, partager des contenus professionnels et publier de manière occasionnelle "
                            "augmente votre visibilité. L'objectif est de montrer votre intérêt pour votre secteur."
                        ),
                    },
                ],
            },
        ],
        "takeaways": [
            "Utilisez un titre professionnel précis.",
            "Ajoutez un résumé orienté résultats.",
            "Activez votre réseau régulièrement.",
        ],
        "key_figures": [
            {
                "value": 70,
                "label": "des recruteurs consultent les profils LinkedIn avant un entretien",
                "suffix": "%",
            },
            {
                "value": 5,
                "label": "compétences clés à afficher sur LinkedIn",
            },
            {
                "value": 1,
                "label": "publication ou commentaire par semaine suffit pour rester visible",
            },
        ],
    },
]


ARTICLE_SERIES = [
    {
        "title": "Guides emploi JobAlert CI",
        "slug": "guides-emploi-jobalert-ci",
        "hue": "sky",
        "description": (
            "Une série de guides pratiques pour améliorer votre CV, réussir vos entretiens "
            "et mieux comprendre le marché de l'emploi en Côte d'Ivoire."
        ),
        "sort_order": 1,
        "article_slugs": [
            "rediger-un-cv-percutant-en-cote-divoire",
            "preparer-un-entretien-d-embauche",
            "competences-recherchees-2026",
        ],
    },
    {
        "title": "Comprendre le marché ivoirien",
        "slug": "comprendre-marche-ivoirien",
        "hue": "cyan",
        "description": (
            "Analyse des tendances, secteurs porteurs et outils pour mieux cibler vos candidatures."
        ),
        "sort_order": 2,
        "article_slugs": [
            "tendances-marche-emploi-ivoirien",
            "secteurs-qui-recrutent-en-cote-divoire",
            "optimiser-son-profil-linkedin",
        ],
    },
]

TITLES_BY_FILIERE = {
    "tech-dev": [
        "Développeur Full Stack Python / React",
        "Ingénieur Data",
        "DevOps Cloud",
        "Développeur Mobile",
        "Analyste BI",
        "Chef de Projet Tech",
        "QA Automation Engineer",
    ],
    "marketing-com": [
        "Chargé de Communication Digitale",
        "Community Manager",
        "Chef de Publicité",
        "Content Manager",
        "Chargé de Marketing",
        "Responsable Réseaux Sociaux",
        "Média Planner",
    ],
    "commercial-vente": [
        "Commercial Terrain",
        "Business Developer",
        "Responsable Grands Comptes",
        "Conseiller Clientèle",
        "Responsable des Ventes",
        "Account Manager",
        "Chargé de Développement Commercial",
    ],
    "comptabilite-finance": [
        "Comptable Général",
        "Contrôleur de Gestion",
        "Auditeur Financier",
        "Responsable Trésorerie",
        "Analyste Crédit",
        "Gestionnaire Paie et Comptabilité",
        "Chef Comptable",
    ],
    "ressources-humaines": [
        "Chargé de Recrutement",
        "Responsable RH",
        "Gestionnaire Paie et Administration",
        "Consultant en Recrutement",
        "Chargé de Formation",
        "Responsable Talents",
        "Assistant RH",
    ],
    "btp-genie-civil": [
        "Ingénieur Génie Civil",
        "Chef de Chantier",
        "Dessinateur Projeteur",
        "Conducteur de Travaux",
        "Ingénieur Structure",
        "Métreur",
        "Responsable QHSE",
    ],
    "logistique-transport": [
        "Responsable Logistique",
        "Gestionnaire de Stock",
        "Coordinateur Transport",
        "Agent de Transit",
        "Responsable Supply Chain",
        "Planificateur Logistique",
        "Responsable Entrepôt",
    ],
    "sante-medical": [
        "Infirmier Diplômé d'État",
        "Médecin Généraliste",
        "Pharmacien",
        "Technicien de Laboratoire",
        "Sage-femme",
        "Responsable Qualité Santé",
        "Assistant Médical",
    ],
    "administration": [
        "Assistant Administratif",
        "Office Manager",
        "Secrétaire de Direction",
        "Chargé de Clientèle",
        "Agent de Back Office",
        "Coordinateur Administratif",
        "Archiviste",
    ],
    "education-formation": [
        "Enseignant de Mathématiques",
        "Formateur Professionnel",
        "Conseiller Pédagogique",
        "Responsable Formation",
        "Assistant d'Éducation",
        "Concepteur Pédagogique",
        "Directeur d'École",
    ],
    "hotellerie-restauration": [
        "Chef de Cuisine",
        "Serveur",
        "Réceptionniste",
        "Responsable de Salle",
        "Gouvernant(e)",
        "Chef de Rang",
        "Manager d'Hôtel",
    ],
    "agriculture-agrobusiness": [
        "Ingénieur Agronome",
        "Technicien Agricole",
        "Responsable d'Exploitation",
        "Chargé de Développement Rural",
        "Spécialiste Élevage",
        "Contrôleur Qualité Agro",
        "Coordinateur Projets Agricoles",
    ],
    "securite-gardiennage": [
        "Agent de Sécurité",
        "Responsable Sécurité",
        "Superviseur HSE",
        "Gardien",
        "Coordinateur Sûreté",
        "Opérateur Vidéosurveillance",
        "Responsable Prévention",
    ],
}


CONTRACTS = [
    ("cdi", "CDI"),
    ("cdd", "CDD"),
    ("stage", "Stage"),
    ("mission", "Mission"),
    ("alternance", "Alternance"),
]

EXPERIENCES = [
    ("debutant", "Débutant", 0, 1),
    ("1-3", "1-3 ans", 1, 3),
    ("3-5", "3-5 ans", 3, 5),
    ("5-plus", "5 ans et plus", 5, None),
]

EDUCATION = [
    ("bac", "Bac", 1),
    ("bac-2", "Bac+2", 2),
    ("bac-3", "Bac+3", 3),
    ("bac-5", "Bac+5", 5),
    ("bac-8", "Bac+8", 8),
]


LOCATIONS = [
    ("Abidjan", "Cocody", "Abidjan - Cocody", False),
    ("Abidjan", "Plateau", "Abidjan - Plateau", False),
    ("Abidjan", "Marcory", "Abidjan - Marcory", False),
    ("Abidjan", "Yopougon", "Abidjan - Yopougon", False),
    ("Abidjan", "Abobo", "Abidjan - Abobo", False),
    ("Abidjan", "Koumassi", "Abidjan - Koumassi", False),
    ("Abidjan", "Treichville", "Abidjan - Treichville", False),
    ("Abidjan", "Port-Bouet", "Abidjan - Port-Bouet", False),
    ("Abidjan", "Adjamé", "Abidjan - Adjamé", False),
    ("Yamoussoukro", "Centre", "Yamoussoukro - Centre", False),
    ("Bouaké", "Centre", "Bouaké - Centre", False),
    ("San-Pédro", "Port", "San-Pédro - Port", False),
    ("Korhogo", "Centre", "Korhogo - Centre", False),
    ("Abidjan", "Télétravail", "Côte d'Ivoire - Télétravail", True),
]


COMPANIES = [
    ("Abidjan Digital Labs", "tech-dev"),
    ("Ivoire Data Services", "tech-dev"),
    ("Com&Sphère", "marketing-com"),
    ("Brand Ivoire Conseil", "marketing-com"),
    ("VentePro CI", "commercial-vente"),
    ("TradeLink Distribution", "commercial-vente"),
    ("Fiducom CI", "comptabilite-finance"),
    ("Audit & Finance Abidjan", "comptabilite-finance"),
    ("Talents & Carrières", "ressources-humaines"),
    ("RH Excellence CI", "ressources-humaines"),
    ("Bâtir Ivoire", "btp-genie-civil"),
    ("Ouvrages & Génie Civil", "btp-genie-civil"),
    ("TransCargo CI", "logistique-transport"),
    ("LogiSupply Abidjan", "logistique-transport"),
    ("Clinique Vie Nouvelle", "sante-medical"),
    ("SantéPlus CI", "sante-medical"),
    ("Bureau Services CI", "administration"),
    ("AdminPartners", "administration"),
    ("École Avenir", "education-formation"),
    ("Formacoop CI", "education-formation"),
    ("Hôtel Lagune Prestige", "hotellerie-restauration"),
    ("Saveurs d'Abidjan", "hotellerie-restauration"),
    ("AgroIvoire", "agriculture-agrobusiness"),
    ("Fermes du Sud", "agriculture-agrobusiness"),
    ("Sécurité Horizon", "securite-gardiennage"),
    ("ProtectCI", "securite-gardiennage"),
]


SPECIALTY_LABELS = [
    "Pilotage",
    "Analyse",
    "Déploiement",
]


SALARIES = [
    "150 000 - 250 000 FCFA / mois",
    "250 000 - 400 000 FCFA / mois",
    "400 000 - 650 000 FCFA / mois",
    "650 000 - 900 000 FCFA / mois",
    "900 000 - 1 300 000 FCFA / mois",
    "Salaire selon profil",
    "Indemnité de stage + avantages",
    "Package fixe + variables",
]


def get_or_create(db, model, lookup: dict, values: dict):
    """
    Récupère ou crée un enregistrement à partir d'une clé fonctionnelle.

    Exemple:
        get_or_create(db, Source, {"code": "novojob"}, {...})
    """
    stmt = select(model)
    for field_name, field_value in lookup.items():
        stmt = stmt.where(getattr(model, field_name) == field_value)

    item = db.scalar(stmt)

    if item is None:
        item = model(**values)
        db.add(item)
    else:
        for field_name, field_value in values.items():
            setattr(item, field_name, field_value)

    db.flush()
    return item


def _model_columns(model) -> set[str]:
    try:
        return {column.key for column in model.__table__.columns}
    except Exception:
        return set()


def _set_if_present(values: dict, columns: set[str], field_names: tuple, value) -> bool:
    for field_name in field_names:
        if field_name in columns:
            values[field_name] = value
            return True
    return False


def _editorial_get_or_create(db, model, lookup: dict, values: dict):
    statement = select(model)

    for field_name, field_value in lookup.items():
        statement = statement.where(getattr(model, field_name) == field_value)

    item = db.scalar(statement)

    if item is None:
        item = model(**values)
        db.add(item)
    else:
        for field_name, field_value in values.items():
            setattr(item, field_name, field_value)

    db.flush()
    return item


def _build_article_html(article_data: dict) -> str:
    html_parts: list[str] = []

    intro = article_data.get("intro")
    if intro:
        html_parts.append(f"<p>{intro}</p>")

    for section in article_data.get("sections", []):
        html_parts.append(f"<h2>{section['title']}</h2>")

        for block in section.get("blocks", []):
            block_type = block.get("block_type", "paragraph")
            content = block.get("content", "")
            attribution = block.get("attribution")

            if block_type == "list":
                items = [
                    item.strip(" -*").strip()
                    for item in content.splitlines()
                    if item.strip()
                ]
                html_items = "".join(f"<li>{item}</li>" for item in items)
                html_parts.append(f"<ul>{html_items}</ul>")

            elif block_type == "quote":
                attribution_html = (
                    f"<footer>{attribution}</footer>" if attribution else ""
                )
                html_parts.append(
                    f"<blockquote><p>{content}</p>{attribution_html}</blockquote>"
                )

            elif block_type == "callout":
                html_parts.append(f"<aside>{content}</aside>")

            else:
                html_parts.append(f"<p>{content}</p>")

    return "\n".join(html_parts)


def _upsert_content_page(
    db,
    *,
    slug: str,
    title: str,
    body: str,
    meta_description: str | None = None,
    image_url: str | None = None,
    excerpt: str | None = None,
    published_at: datetime | None = None,
):
    if not EDITORIAL_SEED_ENABLED or ContentPage is None:
        return None

    columns = _model_columns(ContentPage)

    if "slug" not in columns:
        print("Seed éditorial ignoré : ContentPage n'a pas de colonne slug.")
        return None

    has_title = any(field in columns for field in ("title", "titre"))
    has_body = any(
        field in columns
        for field in ("body", "content", "corps", "content_body", "markdown")
    )

    if not has_title or not has_body:
        print(
            "Seed éditorial ignoré : colonnes title/body introuvables sur ContentPage."
        )
        return None

    page = db.scalar(select(ContentPage).where(ContentPage.slug == slug))

    values: dict = {}

    _set_if_present(values, columns, ("slug",), slug)
    _set_if_present(values, columns, ("title", "titre"), title)
    _set_if_present(
        values,
        columns,
        ("body", "content", "corps", "content_body", "markdown"),
        body,
    )

    if ContentType is not None:
        _set_if_present(
            values,
            columns,
            ("type", "content_type", "page_type"),
            ContentType.ARTICLE,
        )

    if ContentStatus is not None:
        _set_if_present(
            values,
            columns,
            ("status", "statut"),
            ContentStatus.PUBLISHED,
        )

    _set_if_present(values, columns, ("is_published", "published", "publie"), True)
    _set_if_present(values, columns, ("is_active", "active", "actif"), True)

    if meta_description:
        _set_if_present(
            values,
            columns,
            ("meta_description", "seo_description", "description"),
            meta_description,
        )

    if image_url:
        _set_if_present(
            values,
            columns,
            ("image_url", "image", "og_image_url", "cover_url"),
            image_url,
        )

    if excerpt:
        _set_if_present(
            values,
            columns,
            ("excerpt", "summary", "resume", "chapo", "introduction"),
            excerpt,
        )

    if published_at:
        _set_if_present(
            values,
            columns,
            ("published_at", "published_date", "publication_at"),
            published_at,
        )
        _set_if_present(values, columns, ("updated_at",), published_at)

    if "locale" in columns:
        values["locale"] = "fr"

    if page is None:
        page = ContentPage(**values)
        db.add(page)
    else:
        for field_name, field_value in values.items():
            setattr(page, field_name, field_value)

    db.flush()
    return page


def _upsert_article(db, page, article_data: dict, category_id: str | None):
    article = db.scalar(select(Article).where(Article.content_page_id == page.id))

    values = {
        "content_page_id": page.id,
        "category_id": category_id,
        "reading_minutes": article_data.get("reading_minutes", 5),
        "view_count": article_data.get("view_count", 0),
        "is_featured": article_data.get("is_featured", False),
        "featured_order": article_data.get("featured_order"),
        "quote_text": article_data.get("quote_text"),
        "quote_author": article_data.get("quote_author"),
        "tags": article_data.get("tags", []),
    }

    if article is None:
        article = Article(**values)
        db.add(article)
        created = True
    else:
        for field_name, field_value in values.items():
            setattr(article, field_name, field_value)
        created = False

    db.flush()
    return article, created


def _create_article_children(db, article, article_data: dict):
    # Sections
    if not article.sections:
        for position, section_data in enumerate(
            article_data.get("sections", []), start=1
        ):
            section = ArticleSection(
                article_id=article.id,
                position=position,
                anchor=section_data["anchor"],
                title=section_data["title"],
            )
            db.add(section)
            db.flush()

            for block_position, block_data in enumerate(
                section_data.get("blocks", []), start=1
            ):
                db.add(
                    ArticleSectionBlock(
                        section_id=section.id,
                        position=block_position,
                        block_type=block_data.get("block_type", "paragraph"),
                        content=block_data.get("content", ""),
                        attribution=block_data.get("attribution"),
                        metadata_json=block_data.get("metadata_json"),
                    )
                )

        db.flush()

    # Takeaways
    if not article.takeaways:
        for position, text in enumerate(article_data.get("takeaways", []), start=1):
            db.add(
                ArticleTakeaway(
                    article_id=article.id,
                    position=position,
                    text=text,
                )
            )

        db.flush()

    # Key figures
    if not article.key_figures:
        for position, figure in enumerate(article_data.get("key_figures", []), start=1):
            db.add(
                ArticleKeyFigure(
                    article_id=article.id,
                    position=position,
                    value=float(figure.get("value", 0)),
                    label=figure.get("label", ""),
                    prefix=figure.get("prefix"),
                    suffix=figure.get("suffix"),
                )
            )

        db.flush()


def _link_articles_to_series(
    db, series, article_slugs: list[str], articles_by_slug: dict
):
    existing_article_ids = set(
        db.scalars(
            select(SeriesArticle.article_id).where(SeriesArticle.series_id == series.id)
        ).all()
    )

    existing_positions = set(
        db.scalars(
            select(SeriesArticle.position).where(SeriesArticle.series_id == series.id)
        ).all()
    )

    next_position = max(existing_positions, default=0) + 1

    for slug in article_slugs:
        article = articles_by_slug.get(slug)
        if article is None or article.id in existing_article_ids:
            continue

        while next_position in existing_positions:
            next_position += 1

        db.add(
            SeriesArticle(
                series_id=series.id,
                article_id=article.id,
                position=next_position,
            )
        )

        existing_article_ids.add(article.id)
        existing_positions.add(next_position)
        next_position += 1

    db.flush()


def seed_editorial(db) -> None:
    if not EDITORIAL_SEED_ENABLED:
        print("Seed éditorial ignoré : modèles éditoriaux non disponibles.")
        return

    now = datetime.now(timezone.utc).replace(microsecond=0)

    # Catégories
    categories_by_code: dict[str, ArticleCategory] = {}

    for category_data in ARTICLE_CATEGORIES:
        category = _editorial_get_or_create(
            db,
            ArticleCategory,
            {"code": category_data["code"]},
            {
                "code": category_data["code"],
                "label": category_data["label"],
                "slug": category_data["slug"],
                "hue": category_data.get("hue"),
                "icon_name": category_data.get("icon_name"),
                "sort_order": category_data.get("sort_order", 100),
                "is_active": True,
            },
        )
        categories_by_code[category_data["code"]] = category

    # Conseils quotidiens
    for tip_data in DAILY_TIPS:
        category = categories_by_code.get(tip_data.get("category_code"))

        _editorial_get_or_create(
            db,
            DailyTip,
            {"rotation_order": tip_data["rotation_order"]},
            {
                "text": tip_data["text"],
                "rotation_order": tip_data["rotation_order"],
                "is_active": True,
                "category_id": category.id if category else None,
            },
        )

    # Articles
    articles_by_slug: dict[str, Article] = {}

    for index, article_data in enumerate(ARTICLES_SEED, start=1):
        category = categories_by_code.get(article_data["category_code"])
        html_body = _build_article_html(article_data)

        published_at = now - timedelta(days=index, hours=9)

        content_page = _upsert_content_page(
            db,
            slug=article_data["slug"],
            title=article_data["title"],
            body=html_body,
            meta_description=article_data.get("meta_description"),
            image_url=article_data.get("image_url"),
            excerpt=article_data.get("intro"),
            published_at=published_at,
        )

        if content_page is None:
            continue

        article, _article_created = _upsert_article(
            db,
            page=content_page,
            article_data=article_data,
            category_id=category.id if category else None,
        )

        _create_article_children(db, article, article_data)

        articles_by_slug[article_data["slug"]] = article

    # Séries
    for series_data in ARTICLE_SERIES:
        series = _editorial_get_or_create(
            db,
            ArticleSeries,
            {"slug": series_data["slug"]},
            {
                "title": series_data["title"],
                "slug": series_data["slug"],
                "hue": series_data.get("hue"),
                "description": series_data.get("description"),
                "sort_order": series_data.get("sort_order", 100),
                "is_active": True,
            },
        )

        _link_articles_to_series(
            db,
            series=series,
            article_slugs=series_data.get("article_slugs", []),
            articles_by_slug=articles_by_slug,
        )

    db.flush()

    print(
        "Seed éditorial terminé : "
        f"{len(categories_by_code)} catégories, "
        f"{len(DAILY_TIPS)} conseils quotidiens, "
        f"{len(articles_by_slug)} articles, "
        f"{len(ARTICLE_SERIES)} séries."
    )


def get_next_public_id(db, base_public_id: int) -> int:
    public_id = base_public_id

    while (
        db.scalar(select(JobOffer.id).where(JobOffer.public_id == public_id))
        is not None
    ):
        public_id += 1

    return public_id


def seed() -> None:
    with session_scope() as db:
        # ------------------------------------------------------------------
        # 1. Sources
        # ------------------------------------------------------------------
        for order, source_data in enumerate(SOURCES, start=1):
            values = source_data.copy()
            values.update(
                slug=slugify(values["code"]),
                status=SourceStatus.ACTIVE,
                supports_scraping=values.get("supports_scraping", True),
                is_primary=values.get("is_primary", order <= 3),
            )
            get_or_create(db, Source, {"code": values["code"]}, values)

        # ------------------------------------------------------------------
        # 2. Filières, mots-clés et spécialités
        # ------------------------------------------------------------------
        filieres_by_code: dict[str, Filiere] = {}
        specialties_by_filiere: dict[str, list[FiliereSpecialty]] = {}

        for order, (code, label, hue, icon_name, keywords) in enumerate(
            FILIERES, start=1
        ):
            filiere = get_or_create(
                db,
                Filiere,
                {"code": code},
                {
                    "code": code,
                    "label": label,
                    "slug": slugify(code),
                    "hue": hue,
                    "icon_name": icon_name,
                    "tagline": f"Opportunités quotidiennes dans le domaine {label}.",
                    "description": (
                        f"Offres d'emploi, missions et opportunités dans le secteur {label} "
                        "en Côte d'Ivoire."
                    ),
                    "sort_order": order,
                    "is_active": True,
                },
            )
            filieres_by_code[code] = filiere

            for weight, keyword in enumerate(keywords, start=1):
                normalized_keyword = normalize_text(keyword)
                get_or_create(
                    db,
                    FiliereKeyword,
                    {
                        "filiere_id": filiere.id,
                        "normalized_keyword": normalized_keyword,
                    },
                    {
                        "filiere_id": filiere.id,
                        "keyword": keyword,
                        "normalized_keyword": normalized_keyword,
                        "weight": max(1, 100 - weight),
                        "is_active": True,
                    },
                )

            specialties: list[FiliereSpecialty] = []
            for specialty_order, specialty_label in enumerate(
                SPECIALTY_LABELS, start=1
            ):
                specialty_code = f"{code}-{slugify(specialty_label)}"
                specialty = get_or_create(
                    db,
                    FiliereSpecialty,
                    {
                        "filiere_id": filiere.id,
                        "code": specialty_code,
                    },
                    {
                        "filiere_id": filiere.id,
                        "code": specialty_code,
                        "label": specialty_label,
                        "sort_order": specialty_order,
                        "is_active": True,
                    },
                )
                specialties.append(specialty)

            specialties_by_filiere[filiere.id] = specialties

        # ------------------------------------------------------------------
        # 3. Contrats, expériences, niveaux d'études
        # ------------------------------------------------------------------
        for order, (code, label) in enumerate(CONTRACTS, start=1):
            get_or_create(
                db,
                ContractType,
                {"code": code},
                {
                    "code": code,
                    "label": label,
                    "sort_order": order,
                    "is_active": True,
                },
            )

        for order, (code, label, min_years, max_years) in enumerate(
            EXPERIENCES, start=1
        ):
            get_or_create(
                db,
                ExperienceLevel,
                {"code": code},
                {
                    "code": code,
                    "label": label,
                    "min_years": min_years,
                    "max_years": max_years,
                    "sort_order": order,
                    "is_active": True,
                },
            )

        for order, (code, label, rank) in enumerate(EDUCATION, start=1):
            get_or_create(
                db,
                EducationLevel,
                {"code": code},
                {
                    "code": code,
                    "label": label,
                    "rank": rank,
                    "sort_order": order,
                    "is_active": True,
                },
            )

        # ------------------------------------------------------------------
        # 4. Localisations
        # ------------------------------------------------------------------
        for city, district, label, is_remote in LOCATIONS:
            normalized_label = normalize_text(label)
            get_or_create(
                db,
                Location,
                {"normalized_label": normalized_label},
                {
                    "country_code": "CI",
                    "city": city,
                    "district": district,
                    "label": label,
                    "normalized_label": normalized_label,
                    "is_remote": is_remote,
                    "is_active": True,
                },
            )

        # ------------------------------------------------------------------
        # 5. Entreprises
        # ------------------------------------------------------------------
        companies_by_filiere: dict[str, list[Company]] = {}

        if not filieres_by_code:
            raise RuntimeError("Aucune filière disponible pour créer les entreprises.")

        default_filiere = list(filieres_by_code.values())[0]

        for company_name, filiere_code in COMPANIES:
            filiere = filieres_by_code.get(filiere_code, default_filiere)
            company_slug = slugify(company_name)
            normalized_name = normalize_text(company_name)
            website_slug = company_slug.replace("-", "")

            company = get_or_create(
                db,
                Company,
                {"normalized_name": normalized_name},
                {
                    "name": company_name,
                    "normalized_name": normalized_name,
                    "slug": company_slug,
                    "website_url": f"https://www.{website_slug}.ci",
                    "logo_url": f"https://cdn.jobalert.ci/companies/{company_slug}.png",
                    "description": (
                        f"{company_name} recrute régulièrement dans le secteur "
                        f"{filiere.label} en Côte d'Ivoire."
                    ),
                    "primary_filiere_id": filiere.id,
                },
            )

            companies_by_filiere.setdefault(filiere_code, []).append(company)

        # ------------------------------------------------------------------
        # 6. Rechargement des référentiels pour la génération des offres
        # ------------------------------------------------------------------
        sources = list(db.scalars(select(Source).order_by(Source.priority)).all())
        filieres = list(db.scalars(select(Filiere).order_by(Filiere.sort_order)).all())
        contracts = list(
            db.scalars(select(ContractType).order_by(ContractType.sort_order)).all()
        )
        experiences = list(
            db.scalars(
                select(ExperienceLevel).order_by(ExperienceLevel.sort_order)
            ).all()
        )
        educations = list(
            db.scalars(select(EducationLevel).order_by(EducationLevel.sort_order)).all()
        )
        locations = list(db.scalars(select(Location).order_by(Location.label)).all())
        companies = list(db.scalars(select(Company).order_by(Company.name)).all())

        if not sources:
            raise RuntimeError("Aucune source disponible pour créer des offres.")
        if not filieres:
            raise RuntimeError("Aucune filière disponible pour créer des offres.")
        if not contracts:
            raise RuntimeError(
                "Aucun type de contrat disponible pour créer des offres."
            )
        if not experiences:
            raise RuntimeError(
                "Aucun niveau d'expérience disponible pour créer des offres."
            )
        if not educations:
            raise RuntimeError(
                "Aucun niveau d'éducation disponible pour créer des offres."
            )
        if not locations:
            raise RuntimeError("Aucune localisation disponible pour créer des offres.")
        if not companies:
            raise RuntimeError("Aucune entreprise disponible pour créer des offres.")

        # ------------------------------------------------------------------
        # 7. Création d'au moins 84 offres riches
        #    13 filières * 7 offres = 91 offres
        # ------------------------------------------------------------------
        rng = random.Random(20260725)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        published_window_start = now - timedelta(days=28)

        created_offers = 0
        offer_counter = 0

        for filiere_index, filiere in enumerate(filieres):
            titles = TITLES_BY_FILIERE.get(
                filiere.code,
                [
                    f"Chargé(e) de mission {filiere.label}",
                    f"Coordinateur {filiere.label}",
                    f"Spécialiste {filiere.label}",
                    f"Assistant {filiere.label}",
                    f"Responsable {filiere.label}",
                    f"Consultant {filiere.label}",
                    f"Superviseur {filiere.label}",
                ],
            )

            company_pool = companies_by_filiere.get(filiere.code, [])

            for title_index in range(7):
                offer_counter += 1

                title = titles[title_index % len(titles)]

                if company_pool:
                    company = company_pool[title_index % len(company_pool)]
                else:
                    company = companies[offer_counter % len(companies)]

                source = sources[offer_counter % len(sources)]
                location = locations[(offer_counter * 3 + title_index) % len(locations)]
                contract = contracts[(offer_counter + title_index) % len(contracts)]
                experience = experiences[
                    (offer_counter + filiere_index) % len(experiences)
                ]
                education = educations[
                    (offer_counter + title_index + filiere_index) % len(educations)
                ]

                specialty_pool = specialties_by_filiere.get(filiere.id, [])
                specialty = (
                    specialty_pool[title_index % len(specialty_pool)]
                    if specialty_pool
                    else None
                )

                source_short = (
                    (source.short_code or source.code or "SRC").upper().replace("-", "")
                )
                source_reference = f"{source_short}-{offer_counter:05d}"

                slug_base = slugify(f"{title}-{company.name}")
                slug = f"{slug_base}-{source_reference.lower()}"

                source_url = f"{source.base_url.rstrip('/')}/offres/{slug}"
                canonical_url = (
                    f"{source.base_url.rstrip('/')}/offres/{source_reference.lower()}"
                )

                hash_unique = hashlib.sha256(
                    f"{source.code}|{source_reference}|{source_url}".encode("utf-8")
                ).hexdigest()

                existing_offer = db.scalar(
                    select(JobOffer).where(JobOffer.hash_unique == hash_unique)
                )
                if existing_offer is not None:
                    continue

                # Si le slug existe déjà pour une autre offre, on le rend stablement unique.
                if (
                    db.scalar(select(JobOffer.id).where(JobOffer.slug == slug))
                    is not None
                ):
                    slug = f"{slug}-{offer_counter}"
                    source_url = f"{source.base_url.rstrip('/')}/offres/{slug}"
                    hash_unique = hashlib.sha256(
                        f"{source.code}|{source_reference}|{source_url}".encode("utf-8")
                    ).hexdigest()

                    existing_offer = db.scalar(
                        select(JobOffer).where(JobOffer.hash_unique == hash_unique)
                    )
                    if existing_offer is not None:
                        continue

                public_id = get_next_public_id(db, 10000 + offer_counter)

                published_at = published_window_start + timedelta(
                    days=(offer_counter % 24),
                    hours=6 + (offer_counter % 8),
                    minutes=(offer_counter * 7) % 55,
                )
                collected_at = published_at + timedelta(hours=1, minutes=12)
                first_seen_at = collected_at
                last_seen_at = min(now, collected_at + timedelta(days=2, hours=3))
                expires_at = now + timedelta(days=18 + (offer_counter % 21))
                application_deadline_at = now + timedelta(days=7 + (offer_counter % 14))

                salary_raw = SALARIES[(offer_counter + title_index) % len(SALARIES)]
                matched_keywords = KEYWORDS_BY_FILIERE.get(
                    filiere.code, [filiere.label]
                )[:3]

                raw_payload = {
                    "public_id": public_id,
                    "source": source.code,
                    "source_reference": source_reference,
                    "title": title,
                    "company": company.name,
                    "location": location.label,
                    "salary": salary_raw,
                    "contract": contract.label,
                    "experience": experience.label,
                    "education": education.label,
                    "filiere": filiere.label,
                    "published_at": published_at.isoformat(),
                    "collected_at": collected_at.isoformat(),
                    "url": source_url,
                    "canonical_url": canonical_url,
                    "keywords": matched_keywords,
                    "scraped_fields": [
                        "title",
                        "company",
                        "url",
                        "publication_date",
                        "location",
                        "salary",
                    ],
                }

                offer = JobOffer(
                    public_id=public_id,
                    title=title,
                    normalized_title=normalize_text(title),
                    slug=slug,
                    company_id=company.id,
                    source_id=source.id,
                    location_id=location.id,
                    primary_filiere_id=filiere.id,
                    specialty_id=specialty.id if specialty else None,
                    contract_type_id=contract.id,
                    experience_level_id=experience.id,
                    education_level_id=education.id,
                    admin_id=None,
                    status=JobOfferStatus.ACTIVE,
                    origin=JobOfferOrigin.SCRAPING,
                    visible_site=True,
                    is_duplicate=False,
                    duplicate_of_id=None,
                    duplicate_reason="aucun_doublon_detecte",
                    source_reference=source_reference,
                    source_url=source_url,
                    canonical_url=canonical_url,
                    hash_unique=hash_unique,
                    content_hash=hashlib.sha256(
                        f"{title}|{company.normalized_name}|{filiere.code}".encode(
                            "utf-8"
                        )
                    ).hexdigest(),
                    location_raw=location.label,
                    salary_raw=salary_raw,
                    raw_payload=raw_payload,
                    published_at=published_at,
                    collected_at=collected_at,
                    first_seen_at=first_seen_at,
                    last_seen_at=last_seen_at,
                    expires_at=expires_at,
                    application_deadline_at=application_deadline_at,
                    view_count=rng.randint(15, 950),
                    save_count=rng.randint(0, 120),
                )

                db.add(offer)
                db.flush()

                intro = (
                    f"{company.name} recrute un(e) {title} pour renforcer son équipe "
                    f"{filiere.label} à {location.label}. Le poste est proposé en "
                    f"{contract.label} et s'adresse à un profil {experience.label}."
                )

                missions = [
                    f"Participer activement aux projets {filiere.label} de {company.name}.",
                    f"Assurer le suivi opérationnel des activités liées au poste {title}.",
                    "Collaborer avec les équipes internes pour améliorer les processus.",
                    "Contribuer à la qualité de service et à la satisfaction des parties prenantes.",
                ]

                profile_requirements = [
                    f"Expérience ou formation en lien avec le domaine {filiere.label}.",
                    f"Bonne capacité d'adaptation à un environnement {contract.label}.",
                    "Esprit d'analyse, rigueur et autonomie.",
                    "Excellente communication orale et écrite.",
                ]

                benefits = [
                    "Package salarial attractif selon profil",
                    "Formation continue et perspectives d'évolution",
                    "Environnement de travail dynamique",
                ]

                tags = [
                    filiere.label,
                    contract.label,
                    experience.label,
                    education.label,
                    location.city,
                    "Côte d'Ivoire",
                ]

                source_text = "\n".join(
                    [
                        f"Titre : {title}",
                        f"Entreprise : {company.name}",
                        f"Localisation : {location.label}",
                        f"Contrat : {contract.label}",
                        f"Expérience : {experience.label}",
                        f"Formation : {education.label}",
                        f"Salaire : {salary_raw}",
                        "",
                        intro,
                        "",
                        "Missions :",
                        *[f"- {mission}" for mission in missions],
                        "",
                        "Profil recherché :",
                        *[f"- {requirement}" for requirement in profile_requirements],
                        "",
                        "Avantages :",
                        *[f"- {benefit}" for benefit in benefits],
                    ]
                )

                detail = JobOfferDetail(
                    offer_id=offer.id,
                    intro=intro,
                    missions=missions,
                    profile_requirements=profile_requirements,
                    benefits=benefits,
                    tags=tags,
                    source_text=source_text,
                    is_manual=False,
                )

                db.add(detail)

                primary_link = OfferFiliere(
                    offer_id=offer.id,
                    filiere_id=filiere.id,
                    confidence=0.98,
                    is_primary=True,
                    matched_keywords=matched_keywords,
                )
                db.add(primary_link)

                # Une offre sur deux reçoit une filière secondaire pour enrichir le matching.
                if title_index % 2 == 0 and len(filieres) > 1:
                    secondary_filiere = filieres[(filiere_index + 1) % len(filieres)]

                    if secondary_filiere.id != filiere.id:
                        secondary_link_exists = db.scalar(
                            select(OfferFiliere).where(
                                OfferFiliere.offer_id == offer.id,
                                OfferFiliere.filiere_id == secondary_filiere.id,
                            )
                        )

                        if secondary_link_exists is None:
                            secondary_keywords = KEYWORDS_BY_FILIERE.get(
                                secondary_filiere.code,
                                [secondary_filiere.label],
                            )[:2]

                            secondary_link = OfferFiliere(
                                offer_id=offer.id,
                                filiere_id=secondary_filiere.id,
                                confidence=0.66,
                                is_primary=False,
                                matched_keywords=secondary_keywords,
                            )
                            db.add(secondary_link)

                created_offers += 1
                db.flush()

        total_offers = db.scalar(select(func.count(JobOffer.id)))

        seed_editorial(db)

        print(
            "Seed terminé : "
            f"{created_offers} nouvelles offres créées. "
            f"Total des offres en base : {total_offers}."
        )


if __name__ == "__main__":
    seed()
    print("Référentiels et données fictives insérés.")
