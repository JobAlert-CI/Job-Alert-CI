from __future__ import annotations

import json
from typing import Any

from schemas.ai import AIBatchRequest, AIProviderBatchResponse

SYSTEM_PROMPT = """Tu es un specialiste des offres d'emploi en Cote d'Ivoire.
Retourne uniquement du JSON valide, sans markdown ni texte autour.
Ne jamais inventer d'URL, d'entreprise, de salaire ou de fait absent.
Reformate le detail de chaque offre en texte clair et professionnel.
Classe chaque offre parmi les filieres existantes fournies.
Propose une nouvelle filiere seulement si aucune filiere existante ne convient.
Signale les offres douteuses, incompletes ou hors referentiel avec requires_admin_review=true.
Si requires_admin_review=false, primary_filiere_code doit correspondre a une filiere existante.
Les champs de listes doivent contenir uniquement des chaines de caracteres."""


EXPECTED_RESPONSE_EXAMPLE: dict[str, Any] = {
    "results": [
        {
            "offer_id": "uuid",
            "primary_filiere_code": "tech-dev",
            "specialty_code": None,
            "filiere_confidence": 0.9,
            "requires_admin_review": False,
            "suggested_filiere": None,
            "contract_type_code": "cdd",
            "experience_level_code": "1-3",
            "education_level_code": "bac-2",
            "detail": {
                "intro": "Introduction claire de l'offre.",
                "missions": ["Mission principale"],
                "profile_requirements": ["Profil recherche"],
                "benefits": [],
                "tags": ["Abidjan", "Cote d'Ivoire"],
            },
        }
    ]
}


def ai_response_schema_hint() -> dict:
    return AIProviderBatchResponse.model_json_schema()


def build_user_prompt(batch_request: AIBatchRequest) -> str:
    payload = {
        "instructions": [
            "Traite toutes les offres fournies dans offers.",
            "Conserve exactement chaque offer_id recu.",
            "Ignore les champs inconnus dans les offres.",
            "N'invente pas de valeurs absentes ou non inferables avec confiance.",
            "Utilise uniquement les codes de referentiels fournis quand requires_admin_review=false.",
            "Si aucune filiere ne convient, mets requires_admin_review=true et fournis suggested_filiere.",
        ],
        "referentiels": {
            "filieres": [item.model_dump(mode="json") for item in batch_request.filieres],
            "contract_types": [item.model_dump(mode="json") for item in batch_request.contract_types],
            "experience_levels": [item.model_dump(mode="json") for item in batch_request.experience_levels],
            "education_levels": [item.model_dump(mode="json") for item in batch_request.education_levels],
        },
        "offers": [offer.model_dump(mode="json", exclude_none=True) for offer in batch_request.offers],
        "expected_response": EXPECTED_RESPONSE_EXAMPLE,
        "json_schema": batch_request.schema_hint or ai_response_schema_hint(),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def build_batch_prompt(batch_request: AIBatchRequest) -> str:
    return f"{SYSTEM_PROMPT}\n\n{build_user_prompt(batch_request)}"
