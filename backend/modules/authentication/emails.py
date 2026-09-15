"""
Email sending for OTP-based flows (email verification, password reset).

Uses Django's send_mail, backed by whatever EMAIL_BACKEND is configured in
settings (real SMTP if EMAIL_HOST is set, otherwise the console backend,
which just prints the email to the server log). Callers never need to know
which backend is active, a call to send_mail() always "succeeds" either way.
"""

from django.conf import settings
from django.core.mail import send_mail


def _send_otp_email(to_email: str, subject: str, heading: str, otp: str, footer: str) -> None:
    body = (
        f"{heading}\n\n"
        f"Your code is: {otp}\n\n"
        f"This code expires in 15 minutes. If you didn't request this, you can ignore this email.\n\n"
        f"{footer}"
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
        fail_silently=True,  # never let an email outage break signup/login flows
    )


def send_verification_email(to_email: str, otp: str) -> None:
    _send_otp_email(
        to_email=to_email,
        subject="Verify your email, Darkdoctor",
        heading="Confirm your email address to finish setting up your Darkdoctor account.",
        otp=otp,
        footer="Darkdoctor, Verified Reviews by India's Medical Students",
    )


def send_password_reset_email(to_email: str, otp: str) -> None:
    _send_otp_email(
        to_email=to_email,
        subject="Reset your password, Darkdoctor",
        heading="Use this code to reset your Darkdoctor password.",
        otp=otp,
        footer="Darkdoctor, Verified Reviews by India's Medical Students",
    )
