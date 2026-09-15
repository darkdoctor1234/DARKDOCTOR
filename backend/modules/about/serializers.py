from rest_framework import serializers
from .models import AboutUs, SocialHandle


class AboutUsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AboutUs
        fields = ["mission", "vision", "about", "contact_email", "updated_at"]
        read_only_fields = ["updated_at"]


class SocialHandleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SocialHandle
        fields = ["id", "platform", "url", "display_order", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_url(self, value):
        if not value.startswith(("http://", "https://")):
            raise serializers.ValidationError("URL must start with http:// or https://")
        return value
