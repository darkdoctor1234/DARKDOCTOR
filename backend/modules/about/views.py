from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from modules.authentication.permissions import IsSuperAdmin
from .models import AboutUs, SocialHandle
from .serializers import AboutUsSerializer, SocialHandleSerializer


class AboutView(APIView):
    """
    GET   /api/v1/about/  — public, returns full about content + social handles
    PATCH /api/v1/about/  — super admin only, updates mission/vision/about/email
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get(self, request):
        about   = AboutUs.get_instance()
        handles = SocialHandle.objects.all()
        return Response({
            "about":          AboutUsSerializer(about).data,
            "social_handles": SocialHandleSerializer(handles, many=True).data,
        })

    def patch(self, request):
        about = AboutUs.get_instance()
        ser   = AboutUsSerializer(about, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class SocialHandleListCreateView(APIView):
    """
    POST /api/v1/about/social/  — super admin only, creates a new handle
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        ser = SocialHandleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class SocialHandleDetailView(APIView):
    """
    PATCH  /api/v1/about/social/{pk}/  — super admin only, updates a handle
    DELETE /api/v1/about/social/{pk}/  — super admin only, deletes a handle
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def _get_or_404(self, pk):
        try:
            return SocialHandle.objects.get(pk=pk)
        except SocialHandle.DoesNotExist:
            return None

    def patch(self, request, pk):
        handle = self._get_or_404(pk)
        if handle is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SocialHandleSerializer(handle, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        handle = self._get_or_404(pk)
        if handle is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        handle.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
