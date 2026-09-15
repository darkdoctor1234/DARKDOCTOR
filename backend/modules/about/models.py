from django.db import models


class AboutUs(models.Model):
    """
    Singleton — always pk=1.  Stores the platform's mission, vision,
    about text, and contact email.  Use AboutUs.get_instance() everywhere.
    """
    mission       = models.TextField(blank=True, default="")
    vision        = models.TextField(blank=True, default="")
    about         = models.TextField(blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "about_aboutus"

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        # Force singleton: always use pk=1
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "About Darkdoctor"


class SocialHandle(models.Model):
    """
    One row per social media handle.  Platform is a free-text label
    (e.g. "Instagram", "Twitter", "LinkedIn") so no choices enum is needed;
    the frontend resolves the icon from the label.
    """
    platform      = models.CharField(max_length=50)
    url           = models.URLField(max_length=500)
    display_order = models.PositiveIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "about_socialhandle"
        ordering = ["display_order", "created_at"]

    def __str__(self):
        return self.platform
