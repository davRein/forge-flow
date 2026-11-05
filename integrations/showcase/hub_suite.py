"""Suite identities are separate from native Hub accounts, even for equal emails."""
import secrets
from dataclasses import dataclass
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.passwords import hasher
from app.core.suite_client import SuiteClient, SuiteAuthenticationError, SuiteUnavailable, SuiteIdentity
from app.models import User
from app.models.suite import SuiteLink
from app.schemas.auth import UserResponse


@dataclass(frozen=True)
class SuiteUser:
    identity: SuiteIdentity
    user: User


def suite_request(request: Request) -> bool:
    return request.headers.get("x-forgeflow-mode") == "suite"


def native_account_only(request: Request) -> None:
    if suite_request(request):
        raise HTTPException(403, "Manage your login in Dev Suite account settings.")


def suite_user(request: Request, session: Session, settings: Settings) -> SuiteUser:
    cached = getattr(request.state, "suite_user", None)
    if isinstance(cached, SuiteUser):
        return cached
    if not settings.suite_auth_url or not settings.suite_origin:
        raise HTTPException(503, "Suite authentication is not configured.")
    try:
        identity = SuiteClient(settings.suite_auth_url, settings.suite_origin).identify(
            request.headers.get("cookie", "")
        )
    except SuiteAuthenticationError as error:
        raise HTTPException(error.status, "Sign in to Dev Suite again.") from None
    except SuiteUnavailable:
        raise HTTPException(503, "Dev Suite authentication is temporarily unavailable.") from None
    key = (identity.issuer, identity.subject)
    link = session.get(SuiteLink, key)
    if link is None:
        identifier = uuid4()
        user = User(id=identifier, email=f"{identifier}@suite.invalid",
                    password_hash=hasher.hash(secrets.token_urlsafe(48)),
                    # Suite provisioning is not a native privacy acceptance event.
                    # Zero records no acceptance; external AI consent remains false.
                    privacy_accepted_at=0)
        session.add(user)
        session.flush()
        session.add(SuiteLink(issuer=identity.issuer, subject=identity.subject,
                              user_id=identifier, expires_at=identity.expires_at))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        link = session.get(SuiteLink, key)
        if link is None:
            raise HTTPException(503, "Suite workspace could not be initialized.")
    if link.expires_at != identity.expires_at:
        link.expires_at = identity.expires_at
        session.commit()
    user = session.get(User, link.user_id)
    if user is None:
        raise HTTPException(503, "Suite workspace is unavailable.")
    result = SuiteUser(identity, user)
    request.state.suite_user = result
    return result


def suite_user_response(value: SuiteUser) -> UserResponse:
    return UserResponse(id=value.user.id, email=value.identity.email,
                        external_ai_consent=value.user.external_ai_consent)
