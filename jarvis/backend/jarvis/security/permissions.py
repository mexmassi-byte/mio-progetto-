"""Permission levels and the policy that enforces them.

Permissions are enforced in code, at the moment a tool is executed. Nothing
the model writes (and nothing found on a web page) can lower a tool's level.

Levels (Part 10 of the spec):
  autonomous  research, analysis, local docs, CRM updates, drafts, local code
  approval    external messages, calls, publishing, contacting prospects,
              sensitive data, production changes, deployments, installs
  explicit    spending money, purchases, agreements, destructive operations,
              sharing private information, irreversible external actions

``approval`` tools pause the task until the user approves it in the UI.
``explicit`` tools additionally require the user to type a confirmation
phrase, and are never part of an automatically generated plan.
"""

from __future__ import annotations

from enum import Enum


class Permission(str, Enum):
    AUTONOMOUS = "autonomous"
    APPROVAL = "approval"
    EXPLICIT = "explicit"

    @property
    def rank(self) -> int:
        return {"autonomous": 0, "approval": 1, "explicit": 2}[self.value]


EXPLICIT_CONFIRMATION_PHRASE = "CONFERMO"


def needs_user_decision(level: Permission) -> bool:
    return level is not Permission.AUTONOMOUS


def max_level(*levels: Permission) -> Permission:
    return max(levels, key=lambda p: p.rank)
