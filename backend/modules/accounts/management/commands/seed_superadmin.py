from django.core.management.base import BaseCommand
from django.conf import settings
from modules.accounts.models import User


class Command(BaseCommand):
    help = "Create the default super admin account from environment config."

    def handle(self, *args, **options):
        email = settings.SUPERADMIN_EMAIL
        password = settings.SUPERADMIN_PASSWORD

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f"Super admin {email} already exists. Skipping."))
            return

        User.objects.create_user(
            email=email,
            password=password,
            role=User.Role.SUPER_ADMIN,
            full_name="Super Admin",
            is_staff=True,
            is_superuser=True,
        )
        self.stdout.write(self.style.SUCCESS(f"Super admin created: {email}"))
