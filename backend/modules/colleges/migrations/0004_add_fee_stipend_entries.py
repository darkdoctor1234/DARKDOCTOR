import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("colleges", "0003_add_seatentry"),
    ]

    operations = [
        migrations.CreateModel(
            name="FeeEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("program", models.CharField(max_length=100)),
                ("department", models.CharField(blank=True, default="", max_length=150)),
                ("amount", models.PositiveIntegerField(help_text="Annual fee in INR (whole rupees)")),
                ("display_order", models.PositiveIntegerField(default=0)),
                (
                    "college",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fee_entries",
                        to="colleges.college",
                    ),
                ),
            ],
            options={
                "db_table": "colleges_feeentry",
                "ordering": ["display_order", "program", "department"],
            },
        ),
        migrations.CreateModel(
            name="StipendEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("program", models.CharField(max_length=100)),
                ("department", models.CharField(blank=True, default="", max_length=150)),
                ("amount", models.PositiveIntegerField(help_text="Monthly stipend in INR (whole rupees)")),
                ("display_order", models.PositiveIntegerField(default=0)),
                (
                    "college",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stipend_entries",
                        to="colleges.college",
                    ),
                ),
            ],
            options={
                "db_table": "colleges_stipendentry",
                "ordering": ["display_order", "program", "department"],
            },
        ),
    ]
