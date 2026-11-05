"""Verified suite sessions select private repositories; native operation stays independent."""
import hashlib
import threading
from collections import OrderedDict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from psycopg import sql
from pydantic import SecretStr
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from flowpilot.ai.budget import PostgresBudget
from flowpilot.ai.service import AIService
from flowpilot.config import Settings
from flowpilot.database import connect_database
from flowpilot.main import create_app
from flowpilot.migrate import migrate
from flowpilot.suite_client import SuiteClient, SuiteAuthenticationError, SuiteIdentity, SuiteUnavailable


def owner_key(identity: SuiteIdentity) -> str:
    return hashlib.sha256((identity.issuer + "\n" + identity.subject).encode()).hexdigest()[:40]


def tenant_settings(base: Settings, key: str) -> Settings:
    if len(key) != 40 or any(char not in "0123456789abcdef" for char in key):
        raise ValueError("Invalid suite workspace key")
    values: dict[str, object] = {"queue_namespace": "ffs_" + key}
    if base.mode == "infrastructure":
        assert base.database_url is not None
        parts = urlsplit(base.database_url.get_secret_value())
        query = dict(parse_qsl(parts.query))
        # Never fall back to public: an absent table must fail closed.
        query["options"] = "-csearch_path=ffs_" + key + ",pg_catalog"
        values["database_url"] = SecretStr(urlunsplit(parts._replace(query=urlencode(query))))
    else:
        values["demo_store_path"] = base.demo_store_path.parent / "suite" / key / "workflows.json"
    return base.model_copy(update=values)


def prepare_workspace(base: Settings, identity: SuiteIdentity) -> Settings:
    key = owner_key(identity)
    bound = tenant_settings(base, key)
    if base.mode == "infrastructure":
        assert base.database_url is not None and bound.database_url is not None
        with connect_database(base.database_url.get_secret_value(), timeout_ms=15000) as conn:
            conn.execute("SELECT pg_advisory_lock(hashtext(%s))", ("ffs_" + key,))
            row = conn.execute(
                "SELECT schema_name FROM public.flowpilot_suite_workspaces WHERE owner_key=%s", (key,)
            ).fetchone()
            if row is None:
                conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier("ffs_" + key)))
                # Commit schema first; migration is transactional and retryable.
                conn.commit()
                migrate(bound.database_url.get_secret_value(), suite=True)
                conn.execute(
                    "INSERT INTO public.flowpilot_suite_workspaces(owner_key,schema_name,expires_at) "
                    "VALUES (%s,%s,%s) ON CONFLICT(owner_key) DO UPDATE SET expires_at=EXCLUDED.expires_at",
                    (key, "ffs_" + key, identity.expires_at),
                )
            else:
                if row[0] != "ffs_" + key:
                    raise ValueError("Invalid workspace registry")
                conn.execute("UPDATE public.flowpilot_suite_workspaces SET expires_at=%s WHERE owner_key=%s",
                             (identity.expires_at, key))
    return bound


def shared_ai(base: Settings, bound: Settings) -> AIService:
    budget = (PostgresBudget(base.database_url.get_secret_value())
              if base.database_url is not None and base.mode == "infrastructure" else None)
    return AIService(bound, budget=budget)


class SuiteGateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.native: ASGIApp = create_app(settings)
        self.apps: OrderedDict[str, ASGIApp] = OrderedDict()
        self.lock = threading.Lock()

    def private_app(self, identity: SuiteIdentity) -> ASGIApp:
        # Provision/update expiry even for cached applications. Cached apps never cache authentication.
        with self.lock:
            bound = prepare_workspace(self.settings, identity)
            key = owner_key(identity)
            if key not in self.apps:
                self.apps[key] = create_app(bound, ai_service=shared_ai(self.settings, bound))
            self.apps.move_to_end(key)
            while len(self.apps) > 32:
                self.apps.popitem(last=False)
            return self.apps[key]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.native(scope, receive, send)
            return
        request = Request(scope)
        if request.headers.get("x-forgeflow-mode") != "suite":
            await self.native(scope, receive, send)
            return
        status, message = 503, "Suite authentication is unavailable."
        try:
            if not self.settings.suite_auth_url or not self.settings.suite_origin:
                raise SuiteUnavailable()
            if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("origin") != self.settings.suite_origin:
                raise SuiteAuthenticationError(403)
            identity = await run_in_threadpool(
                SuiteClient(self.settings.suite_auth_url, self.settings.suite_origin).identify,
                request.headers.get("cookie", ""),
            )
            app = await run_in_threadpool(self.private_app, identity)
        except SuiteAuthenticationError as error:
            status, message = error.status, "Sign in to Dev Suite again."
        except Exception:
            # Database/configuration failures never route into the native global workspace.
            pass
        else:
            await app(scope, receive, send)
            return
        response = JSONResponse({"error": {"code": "suite_session", "message": message}},
                                status_code=status, headers={"Cache-Control": "no-store"})
        await response(scope, receive, send)


def create_gateway() -> SuiteGateway:
    return SuiteGateway(Settings())


def workspace_settings(base: Settings) -> list[Settings]:
    if base.mode != "infrastructure" or base.database_url is None:
        return []
    with connect_database(base.database_url.get_secret_value()) as conn:
        rows = conn.execute("SELECT owner_key,schema_name FROM public.flowpilot_suite_workspaces "
                            "WHERE expires_at IS NULL OR expires_at > now() ORDER BY owner_key").fetchall()
    result = []
    for key, schema in rows:
        if schema != "ffs_" + key:
            raise ValueError("Invalid suite workspace registry")
        result.append(tenant_settings(base, key))
    return result


def migrate_workspaces() -> None:
    base = Settings()
    for bound in workspace_settings(base):
        assert bound.database_url is not None
        migrate(bound.database_url.get_secret_value(), suite=True)


if __name__ == "__main__":
    migrate_workspaces()
