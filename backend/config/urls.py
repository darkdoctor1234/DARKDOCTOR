from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .views import health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("django-admin/", admin.site.urls),
    path("api/v1/auth/", include("modules.authentication.urls")),
    path("api/v1/accounts/", include("modules.accounts.urls")),
    path("api/v1/colleges/", include("modules.colleges.urls")),
    path("api/v1/about/",    include("modules.about.urls")),
    path("api/v1/communities/", include("modules.communities.urls")),
    path("api/v1/notifications/", include("modules.notifications.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
