from django.urls import path
from .views import (
    AdminLoginView, SuperAdminLoginView, UserLoginView,
    RegisterView, LogoutView, TokenRefreshView,
    ForgotPasswordView, ResetPasswordView,
    UsernameCheckView, EmailCheckView, UpdateUsernameView,
    SendEmailVerificationView, VerifyEmailView,
)

urlpatterns = [
    path("register/",          RegisterView.as_view(),        name="register"),
    path("user/login/",        UserLoginView.as_view(),        name="user-login"),
    path("admin/login/",       AdminLoginView.as_view(),       name="admin-login"),
    path("superadmin/login/",  SuperAdminLoginView.as_view(),  name="superadmin-login"),
    path("logout/",            LogoutView.as_view(),           name="logout"),
    path("token/refresh/",     TokenRefreshView.as_view(),     name="token-refresh"),
    path("forgot-password/",   ForgotPasswordView.as_view(),  name="forgot-password"),
    path("reset-password/",    ResetPasswordView.as_view(),   name="reset-password"),
    path("username-check/",    UsernameCheckView.as_view(),   name="username-check"),
    path("email-check/",       EmailCheckView.as_view(),      name="email-check"),
    path("username/",          UpdateUsernameView.as_view(),  name="update-username"),
    path("email/send-verification/", SendEmailVerificationView.as_view(), name="send-email-verification"),
    path("email/verify/",            VerifyEmailView.as_view(),           name="verify-email"),
]
