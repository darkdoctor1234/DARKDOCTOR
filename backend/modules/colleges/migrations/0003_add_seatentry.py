import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("colleges", "0002_add_state_to_college"),
    ]

    operations = [
        migrations.CreateModel(
            name="SeatEntry",
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
                ("seats", models.PositiveIntegerField()),
                ("display_order", models.PositiveIntegerField(default=0)),
                (
                    "college",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="seat_entries",
                        to="colleges.college",
                    ),
                ),
            ],
            options={
                "db_table": "colleges_seatentry",
                "ordering": ["display_order", "program", "department"],
            },
        ),
    ]
