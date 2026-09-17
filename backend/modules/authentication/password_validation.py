from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


def validate_password_strength(password, user=None):
    """Runs Django's own AUTH_PASSWORD_VALIDATORS (config/settings/base.py
    — minimum length, not-too-similar-to-user-attributes, not a common
    password, not entirely numeric) and raises a DRF ValidationError with
    all the specific reasons if it fails.

    Every place in this codebase that sets a password (registration,
    password reset, admin creation/edit) must call this — those
    validators are configured but Django never runs them on its own
    outside ModelForm/UserCreationForm, which nothing here uses. Pass
    `user` when one exists/is being built (even an unsaved in-memory
    instance is enough) so UserAttributeSimilarityValidator can actually
    compare against email/name; pass None only when no such context
    exists at all yet.
    """
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
