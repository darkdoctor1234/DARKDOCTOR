import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    """Requires at least one uppercase letter, one lowercase letter, and one
    digit-or-special-character — the client's published password policy.
    Registered in AUTH_PASSWORD_VALIDATORS (config/settings/base.py) alongside
    MinimumLengthValidator (set to 6 there, also per the client's policy), so
    every password-setting path (registration, reset, admin-set) goes through
    validate_password_strength and gets this for free.
    """

    def validate(self, password, user=None):
        errors = []
        if not re.search(r"[A-Z]", password):
            errors.append(_("Password must contain at least 1 uppercase letter."))
        if not re.search(r"[a-z]", password):
            errors.append(_("Password must contain at least 1 lowercase letter."))
        if not re.search(r"[0-9!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
            errors.append(_("Password must contain at least 1 number or special character."))
        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must contain at least 1 uppercase letter, "
            "1 lowercase letter, and 1 number or special character."
        )
