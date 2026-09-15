from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AboutUs",
            fields=[
                ("id",            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mission",       models.TextField(blank=True, default="")),
                ("vision",        models.TextField(blank=True, default="")),
                ("about",         models.TextField(blank=True, default="")),
                ("contact_email", models.EmailField(blank=True, default="", max_length=254)),
                ("updated_at",    models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "about_aboutus"},
        ),
        migrations.CreateModel(
            name="SocialHandle",
            fields=[
                ("id",            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("platform",      models.CharField(max_length=50)),
                ("url",           models.URLField(max_length=500)),
                ("display_order", models.PositiveIntegerField(default=0)),
                ("created_at",    models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "about_socialhandle", "ordering": ["display_order", "created_at"]},
        ),
    ]
