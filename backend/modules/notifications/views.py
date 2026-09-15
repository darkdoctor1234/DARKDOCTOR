from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Notification
from .serializers import NotificationSerializer

_LIST_LIMIT = 30


class NotificationListView(APIView):
    """Authenticated user: latest notifications + unread count."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)
        unread_count = qs.filter(is_read=False).count()
        results = NotificationSerializer(qs[:_LIST_LIMIT], many=True).data
        return Response({"unread_count": unread_count, "results": results})


class NotificationMarkReadView(APIView):
    """Authenticated user: mark a single notification as read."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response({"detail": "Marked as read."})


class NotificationMarkAllReadView(APIView):
    """Authenticated user: mark every unread notification as read."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "All notifications marked as read."})
