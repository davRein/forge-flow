"""Server-side Dev Suite session introspection. Never trusts browser identity fields."""
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from http.cookies import CookieError, SimpleCookie
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, OpenerDirector, ProxyHandler, Request, build_opener

COOKIE_NAME = "FORGEFLOW_SESSION"


class SuiteAuthenticationError(Exception):
    def __init__(self, status: int = 401) -> None:
        self.status = status
        super().__init__("Dev Suite session is not authorized.")


class SuiteUnavailable(Exception):
    pass


@dataclass(frozen=True)
class SuiteIdentity:
    issuer: str
    subject: str
    email: str
    name: str
    administrator: bool
    expires_at: datetime | None = None


def session_cookie(header: str) -> str:
    if len(header) > 16384:
        raise SuiteAuthenticationError()
    try:
        cookies: SimpleCookie[str] = SimpleCookie()
        cookies.load(header)
        token = cookies[COOKIE_NAME].value if COOKIE_NAME in cookies else ""
    except CookieError:
        raise SuiteAuthenticationError() from None
    if not re.fullmatch(r"[A-Za-z0-9._~+/=-]{16,512}", token):
        raise SuiteAuthenticationError()
    return token


def validate_configuration(url: str, issuer: str) -> None:
    origin = urlsplit(issuer)
    target = urlsplit(url)
    loopback = {"localhost", "127.0.0.1", "::1"}
    if (origin.scheme not in {"https", "http"} or not origin.netloc or origin.username
            or origin.path or origin.query or origin.fragment
            or (origin.scheme == "http" and origin.hostname not in loopback)):
        raise ValueError("Suite origin must be an exact HTTPS origin or local loopback origin.")
    if (target.path != "/api/v1/auth/showcase-session" or target.username or target.query
            or target.fragment or not target.netloc
            or not ((target.scheme == "http" and target.hostname in loopback)
                    or (target.scheme == "https" and target.netloc == origin.netloc))):
        raise ValueError("Suite session URL must be the configured loopback or same-site endpoint.")


def parse_identity(value: object, issuer: str) -> SuiteIdentity:
    if not isinstance(value, dict) or value.get("issuer") != issuer:
        raise SuiteUnavailable("Invalid suite identity response.")
    if value.get("active") is not True or value.get("portalOnly") is not False:
        raise SuiteAuthenticationError(403)
    subject, email, name = value.get("id"), value.get("email"), value.get("name")
    administrator = value.get("administrator")
    if (not isinstance(subject, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", subject)
            or not isinstance(email, str) or not 1 <= len(email) <= 254
            or not isinstance(name, str) or not 1 <= len(name) <= 1000
            or not isinstance(administrator, bool)):
        raise SuiteUnavailable("Invalid suite identity response.")
    expiry = None
    if value.get("expiresAt") is not None:
        try:
            raw = value["expiresAt"]
            if not isinstance(raw, str):
                raise ValueError()
            expiry = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                raise ValueError()
        except ValueError:
            raise SuiteUnavailable("Invalid suite expiry response.") from None
        if expiry <= datetime.now(UTC):
            raise SuiteAuthenticationError()
    return SuiteIdentity(issuer, subject, email, name, administrator, expiry)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: object, code: int, msg: str,
                         headers: object, newurl: str) -> None:
        return None


class SuiteClient:
    def __init__(self, url: str, issuer: str, opener: OpenerDirector | None = None, *, app: str | None = None) -> None:
        validate_configuration(url, issuer)
        if app not in {None, "knowledgeHub", "flowPilot"}:
            raise ValueError("Unknown suite application.")
        self.url, self.issuer = url + ("?app=" + app if app else ""), issuer
        self.opener = opener or build_opener(ProxyHandler({}), NoRedirect())

    def identify(self, cookie_header: str) -> SuiteIdentity:
        token = session_cookie(cookie_header)
        request = Request(self.url, headers={"Cookie": COOKIE_NAME + "=" + token,
                                             "Accept": "application/json"})
        try:
            with self.opener.open(request, timeout=3) as response:
                if response.status != 200 or response.headers.get_content_type() != "application/json":
                    raise SuiteUnavailable("Suite session endpoint is unavailable.")
                content = response.read(16385)
                if len(content) > 16384:
                    raise SuiteUnavailable("Suite session response is too large.")
            data: object = json.loads(content)
        except HTTPError as error:
            if error.code in {401, 403}:
                raise SuiteAuthenticationError(error.code) from None
            raise SuiteUnavailable("Suite session endpoint is unavailable.") from None
        except (URLError, OSError, ValueError):
            raise SuiteUnavailable("Suite session endpoint is unavailable.") from None
        return parse_identity(data, self.issuer)
