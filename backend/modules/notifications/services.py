from .models import Notification


def notify(recipient, verb, message, url="", actor=None):
    """Best-effort — a notification failure should never block the action
    that triggered it (same convention as communities.services.sync_memberships)."""
    if recipient is None or (actor is not None and actor.id == recipient.id):
        return
    try:
        Notification.objects.create(
            recipient=recipient, actor=actor, verb=verb, message=message, url=url,
        )
    except Exception:
        pass


def notify_many(recipients, verb, message, url="", actor=None):
    seen = set()
    for recipient in recipients:
        if recipient is None or recipient.id in seen:
            continue
        seen.add(recipient.id)
        notify(recipient, verb, message, url=url, actor=actor)
