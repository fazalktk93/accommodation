import logging
from logging.config import dictConfig

def setup_logging():
    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "format": (
                    '{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s",'
                    '"message":"%(message)s","module":"%(module)s","func":"%(funcName)s",'
                    '"line":%(lineno)d}'
                )
            }
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler", "formatter": "json"}
        },
        "root": {"level": "INFO", "handlers": ["console"]},
        "loggers": {
            "uvicorn.access": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "app": {"level": "INFO", "handlers": ["console"], "propagate": False},
        },
    })

class AuditLogger:
    """Thin wrapper to emit structured audit logs."""
    def __init__(self) -> None:
        self._log = logging.getLogger("app.audit")

    def emit(self, actor: str, action: str, resource: str, resource_id: str, success: bool, **extra):
        payload = {"actor": actor, "action": action, "resource": resource, "resource_id": resource_id, "success": success}
        payload.update(extra or {})
        self._log.info("AUDIT %s", payload)

audit_logger = AuditLogger()
