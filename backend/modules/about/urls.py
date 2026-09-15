from django.urls import path
from .views import AboutView, SocialHandleListCreateView, SocialHandleDetailView

urlpatterns = [
    path("",              AboutView.as_view(),                name="about"),
    path("social/",       SocialHandleListCreateView.as_view(), name="about-social-list"),
    path("social/<int:pk>/", SocialHandleDetailView.as_view(), name="about-social-detail"),
]
