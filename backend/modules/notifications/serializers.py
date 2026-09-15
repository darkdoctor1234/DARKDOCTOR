from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "verb", "message", "url", "is_read", "created_at", "actor_name"]

    def get_actor_name(self, obj):
        return obj.actor.username if obj.actor and obj.actor.username else None
