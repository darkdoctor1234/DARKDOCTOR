from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(
                blank=True,
                null=True,
                default=None,
                help_text="Public display name shown on reviews. Alphanumeric and underscores only.",
                max_length=30,
                unique=True,
            ),
        ),
    ]
