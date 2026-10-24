#!/usr/bin/env python3
"""Read-only AI diagnosis. Never prints raw journal messages or credentials."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


PROVIDER_ERRORS = (
    "BadRequestException", "AuthenticationException", "PermissionDeniedException",
    "NotFoundException", "UnprocessableEntityException", "RateLimitException",
    "InternalServerException", "OpenAIIOException", "OpenAIInvalidDataException",
    "OpenAIException",
)
PARAMETERS = (
    "model", "tools", "tool_choice", "parallel_tool_calls", "reasoning_effort",
    "max_completion_tokens", "max_tokens", "stream", "stream_options", "messages",
    "temperature", "service_tier", "response_format",
)
CODES = (
    "unsupported_parameter", "unsupported_value", "invalid_value", "invalid_parameter",
    "invalid_request_error", "invalid_api_key", "model_not_found", "permission_denied",
    "invalid_function_parameters", "invalid_json_schema", "context_length_exceeded",
    "rate_limit_exceeded", "credit_balance_exhausted", "insufficient_quota", "other", "absent",
)


def summarize_message(message):
    """Return fixed categories only, even if a provider message echoes secrets."""
    facts = []
    for name in PROVIDER_ERRORS:
        match = re.search(r"\bcom\.openai\.errors\." + name + r":(?: (\d{3})(?=[:\s]|$))?", message)
        if match:
            status = match.group(1) or "unknown"
            facts.append(f"provider_exception={name} status={status}")
    lowered = message.lower()
    for phrase, category in (
        ("unsupported parameter", "unsupported_parameter"),
        ("unsupported value", "unsupported_value"),
        ("invalid schema", "invalid_tool_schema"),
        ("incorrect api key", "invalid_api_key"),
        ("does not support function", "function_calling_unsupported"),
        ("does not support tools", "tools_unsupported"),
    ):
        if phrase in lowered:
            fields = [name for name in PARAMETERS if re.search(r"['\"]" + name + r"['\"]", message)]
            facts.append("reason=" + category + " parameter=" + (",".join(fields) or "unknown"))
    # The application's new diagnostics already omit provider text. Still project
    # only closed categories, so this also handles old or forged journal entries.
    match = re.search(r"AI diagnostic phase=(request|text|tool_selection|final_answer) category=(provider|internal)\b", message)
    if match:
        facts.append(f"phase={match.group(1)} category={match.group(2)}")
        status = re.search(r"\bstatus=([1-5][0-9]{2})(?=\s|$)", message)
        if status:
            facts.append("status=" + status.group(1))
        for field, values in (("code", CODES), ("parameter", PARAMETERS + ("other", "absent"))):
            for value in values:
                if re.search(r"\b" + field + "=" + value + r"(?=\s|$)", message):
                    facts.append(field + "=" + value)
                    break
    for name in ("NullPointerException", "IllegalArgumentException", "IllegalStateException"):
        if re.search(r"\bjava\.lang\." + name + r"\b", message):
            facts.append("runtime_exception=" + name)
    for name in ("OpenAiModelGateway", "ProjectTools", "AgentStreams", "AgentService"):
        match = re.search(r"\bde\.forgeflow\.ai\." + name + r"(?:\$[A-Za-z]+)?\.[A-Za-z0-9_$]+\(" + name + r"\.java:(\d{1,6})\)", message)
        if match:
            facts.append(f"location={name}.java:{match.group(1)}")
    return facts


def main():
    if not hasattr(os, "geteuid") or os.geteuid() != 0:
        sys.exit("Run on Ubuntu: sudo python3 diagnose-linux-ai.py")
    print("Read-only diagnosis: no restart, no config changes, no OpenAI requests.")
    jar = Path("/opt/forgeflow/backend.jar")
    try:
        digest = hashlib.sha256()
        with jar.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        print("backend_sha256=" + digest.hexdigest())
    except OSError:
        print("backend_sha256=unavailable")
    try:
        model = "absent"
        with Path("/etc/forgeflow/backend.env").open(encoding="utf-8") as stream:
            for line in stream:
                match = re.fullmatch(r"\s*AI_MODEL\s*=\s*['\"]?([A-Za-z0-9_.:/-]{1,100})['\"]?\s*", line)
                if match:
                    model = match.group(1) if not match.group(1).startswith("sk-") else "redacted-invalid-model"
        print("AI_MODEL=" + model)
    except OSError:
        print("AI_MODEL=unavailable")
    journal = subprocess.run(
        ["journalctl", "-u", "forgeflow", "-b", "-n", "1200", "--no-pager", "-o", "json"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    if journal.returncode:
        sys.exit("Journal unavailable; raw stderr suppressed.")
    reports = []
    for line in journal.stdout.splitlines():
        try:
            record = json.loads(line)
            message = record.get("MESSAGE", "")
            if not isinstance(message, str):
                continue
            facts = summarize_message(message)
            if facts:
                timestamp = datetime.datetime.fromtimestamp(int(record["__REALTIME_TIMESTAMP"]) / 1_000_000, datetime.timezone.utc)
                reports.append(timestamp.strftime("%Y-%m-%d %H:%M:%S UTC ") + " | ".join(facts))
        except (ValueError, TypeError, KeyError, OverflowError, OSError):
            continue
    print("Recent sanitized diagnostics (last 20 matching journal entries):")
    print("\n".join(reports[-20:]) or "No matching errors in the last 1200 entries of this boot.")


if __name__ == "__main__":
    main()
