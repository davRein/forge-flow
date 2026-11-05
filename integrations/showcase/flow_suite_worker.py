"""One process services native and private queues without mixing repositories."""
import logging
import time

from flowpilot.config import Settings
from flowpilot.jobs.runtime import build_worker
from flowpilot.suite_gateway import shared_ai, workspace_settings


def main() -> None:
    base = Settings()
    native = build_worker(base)
    try:
        while True:
            native.tick()
            for bound in workspace_settings(base):
                worker = build_worker(bound, ai_service=shared_ai(base, bound))
                try:
                    worker.tick()
                except Exception:
                    logging.warning("Suite worker iteration failed; retrying.")
                finally:
                    worker.broker.client.close()
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
