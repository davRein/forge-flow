"""Apply the shared integration sources to sibling app checkouts (development only)."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT.parent / "ai-knowledge-hub"
FLOW = ROOT.parent / "flowpilot-codex-starter"


def edit(path: Path, before: str, after: str) -> None:
    source = path.read_text(encoding="utf-8")
    if after in source:
        return
    if before not in source:
        raise RuntimeError(f"Expected source not found: {path}: {before[:60]}")
    path.write_text(source.replace(before, after), encoding="utf-8", newline="\n")


def install() -> None:
    for target in [HUB / "backend/app/core/suite_client.py",
                   FLOW / "backend/src/flowpilot/suite_client.py"]:
        shutil.copyfile(ROOT / "integrations/showcase/suite_client.py", target)
    for name, target in [
        ("hub_suite.py", "backend/app/core/suite.py"),
        ("hub_suite_model.py", "backend/app/models/suite.py"),
        ("hub_suite_migration.py", "backend/alembic/versions/0004_suite_identities.py"),
    ]:
        shutil.copyfile(ROOT / "integrations/showcase" / name, HUB / target)
    edit(HUB / "backend/app/models/__init__.py", "from app.models.auth import", "from app.models.suite import SuiteLink\nfrom app.models.auth import")
    edit(HUB / "backend/app/core/config.py", '    app_name: str =', '    suite_auth_url: str | None = None\n    suite_origin: str | None = None\n\n    app_name: str =')
    edit(HUB / "backend/app/core/config.py", '        if self.app_mode == "authenticated"',
         '        from app.core.suite_client import validate_configuration\n\n'
         '        if self.suite_auth_url or self.suite_origin:\n'
         '            validate_configuration(self.suite_auth_url or "", self.suite_origin or "")\n'
         '            if not self.security_key or len(self.security_key.get_secret_value()) < 32:\n'
         '                raise ValueError("Suite mode requires SECURITY_KEY")\n'
         '        if self.app_mode == "authenticated"')
    edit(HUB / "backend/app/core/access.py", 'from app.core.config import Settings',
         'from app.core.suite import SuiteUser, suite_request, suite_user\nfrom app.core.suite_client import session_cookie\nfrom app.core.config import Settings')
    edit(HUB / "backend/app/core/access.py", '    user: User | None = None', '    user: User | None = None\n    suite: SuiteUser | None = None')
    edit(HUB / "backend/app/core/access.py", '    if settings.app_mode == "local-demo":\n        return Principal(settings.local_workspace_id)\n    token = request.cookies.get(cookie_name(settings))\n    user = AuthService(session, settings).find_user(token)',
         '    linked = None\n    if suite_request(request):\n        linked = suite_user(request, session, settings)\n        user = linked.user\n        token = session_cookie(request.headers.get("cookie", ""))\n    else:\n        if settings.app_mode == "local-demo":\n            return Principal(settings.local_workspace_id)\n        token = request.cookies.get(cookie_name(settings))\n        user = AuthService(session, settings).find_user(token)')
    edit(HUB / "backend/app/core/access.py", '    return Principal(user.id, user)', '    return Principal(user.id, user, linked)')
    edit(HUB / "backend/app/schemas/auth.py", 'class SessionResponse(BaseModel):', 'class SessionResponse(BaseModel):\n    auth_source: Literal["standalone", "suite"] = "standalone"')
    auth = HUB / "backend/app/api/auth.py"
    edit(auth, 'from app.core.access import', 'from app.core.suite import native_account_only, suite_request, suite_user, suite_user_response\nfrom app.core.suite_client import session_cookie\nfrom app.core.access import')
    edit(auth, '    if settings.app_mode == "local-demo":\n        return SessionResponse(mode="local-demo")',
         '    if suite_request(request):\n        linked = suite_user(request, session, settings)\n        return SessionResponse(mode="authenticated", auth_source="suite",\n            user=suite_user_response(linked),\n            csrf_token=csrf_token(session_cookie(request.headers.get("cookie", "")), settings))\n    if settings.app_mode == "local-demo":\n        return SessionResponse(mode="local-demo")')
    # Login management always stays with the session issuer.
    for name in ["register", "login", "logout", "change_password", "delete_account"]:
        source = auth.read_text(encoding="utf-8")
        begin = source.index(f"def {name}(")
        end = source.find('\n\n@', begin)
        end = len(source) if end < 0 else end
        section = source[begin:end]
        if name == "delete_account" and '    request: Request,' not in section:
            section = section.replace('    payload: PasswordConfirmation,', '    payload: PasswordConfirmation,\n    request: Request,')
        if '    native_account_only(request)' not in section:
            section = section.replace('    auth_mode(settings)', '    native_account_only(request)\n    auth_mode(settings)', 1)
        auth.write_text(source[:begin] + section + source[end:], encoding="utf-8", newline="\n")
    edit(auth, '"user": UserResponse.model_validate(principal.user),', '"user": suite_user_response(principal.suite) if principal.suite else UserResponse.model_validate(principal.user),')
    edit(auth, '    return UserResponse.model_validate(principal.user)', '    return suite_user_response(principal.suite) if principal.suite else UserResponse.model_validate(principal.user)')
    edit(FLOW / "backend/src/flowpilot/config.py", '    mode: Literal', '    suite_auth_url: str | None = None\n    suite_origin: str | None = None\n\n    mode: Literal')
    edit(FLOW / "backend/src/flowpilot/config.py", '        if self.ai_mode == "live":',
         '        from flowpilot.suite_client import validate_configuration\n\n'
         '        if self.suite_auth_url or self.suite_origin:\n'
         '            validate_configuration(self.suite_auth_url or "", self.suite_origin or "")\n'
         '        if self.ai_mode == "live":')
    for name in ["suite_gateway", "suite_worker"]:
        shutil.copyfile(ROOT / "integrations/showcase" / ("flow_" + name + ".py"),
                        FLOW / "backend/src/flowpilot" / (name + ".py"))
    (FLOW / "backend/src/flowpilot/migrations/006_suite_workspaces.sql").write_text(
        "CREATE TABLE public.flowpilot_suite_workspaces (owner_key text PRIMARY KEY, "
        "schema_name text UNIQUE NOT NULL, expires_at timestamptz, "
        "created_at timestamptz NOT NULL DEFAULT now());\n", encoding="utf-8")
    edit(FLOW / "backend/src/flowpilot/migrate.py", 'def migrate(url: str) -> None:', 'def migrate(url: str, suite: bool = False) -> None:')
    edit(FLOW / "backend/src/flowpilot/migrate.py", '            if conn.execute(', '            if suite and path.name == "006_suite_workspaces.sql":\n                continue\n            if conn.execute(')
    edit(FLOW / "backend/src/flowpilot/jobs/runtime.py", 'def build_worker(settings: Settings) -> Worker:', 'def build_worker(settings: Settings, ai_service: AIService | None = None) -> Worker:')
    edit(FLOW / "backend/src/flowpilot/jobs/runtime.py", '        AIService(settings),', '        ai_service if ai_service is not None else AIService(settings),')
    edit(HUB / "backend/app/main.py", 'allow_credentials=config.app_mode == "authenticated",', 'allow_credentials=config.app_mode == "authenticated" or bool(config.suite_auth_url),')
    edit(HUB / "backend/app/main.py", '"X-CSRF-Token"],', '"X-CSRF-Token", "X-ForgeFlow-Mode"],')


if __name__ == "__main__":
    install()
