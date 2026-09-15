import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colleges', '0001_initial'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_status', models.CharField(blank=True, choices=[('ug_aspirant', 'UG Aspirant'), ('ug_student', 'UG Student'), ('pg_aspirant', 'PG Aspirant'), ('pg_student', 'PG Student'), ('working_professional', 'Working Professional'), ('alumni', 'Alumni'), ('other', 'Other')], default='', max_length=30)),
                ('highest_education', models.CharField(blank=True, choices=[('ug', 'UG'), ('pg', 'PG')], default='', max_length=10)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('address', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('pg_college', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pg_profiles', to='colleges.college')),
                ('ug_college', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ug_profiles', to='colleges.college')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'accounts_userprofile',
            },
        ),
    ]
