from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User
from modules.notifications.models import Notification
from modules.notifications.services import notify, notify_many


class NotifyServiceTests(TestCase):
    """Unit tests on the notify()/notify_many() helpers themselves — the
    self-notification guard and best-effort error swallowing matter more
    here than any single trigger point that calls them."""

    def setUp(self):
        self.recipient = User.objects.create_user(email="recipient@example.com", password="x", username="recipient1")
        self.actor = User.objects.create_user(email="actor@example.com", password="x", username="actor1")

    def test_notify_creates_a_row(self):
        notify(self.recipient, "review_new", "A new review was posted.", url="/x", actor=self.actor)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient).count(), 1)

    def test_notify_never_notifies_a_user_about_their_own_action(self):
        notify(self.recipient, "review_helpful", "Someone liked your review.", actor=self.recipient)
        self.assertEqual(Notification.objects.count(), 0)

    def test_notify_with_none_recipient_is_a_silent_noop(self):
        notify(None, "review_new", "x")
        self.assertEqual(Notification.objects.count(), 0)

    def test_notify_many_deduplicates_recipients(self):
        other = User.objects.create_user(email="other@example.com", password="x", username="other1")
        notify_many([self.recipient, other, self.recipient], "college_change_approved", "x", actor=self.actor)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient).count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=other).count(), 1)

    def test_notify_many_excludes_the_actor_from_recipients(self):
        notify_many([self.recipient, self.actor], "discussion_reply", "x", actor=self.actor)
        self.assertEqual(Notification.objects.filter(recipient=self.actor).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient).count(), 1)


class NotificationEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="notifuser@example.com", password="x", username="notifuser")
        self.other = User.objects.create_user(email="notifother@example.com", password="x", username="notifother")
        self.client.force_authenticate(user=self.user)

    def test_list_returns_only_own_notifications_with_unread_count(self):
        Notification.objects.create(recipient=self.user, verb="review_new", message="a")
        Notification.objects.create(recipient=self.user, verb="review_new", message="b", is_read=True)
        Notification.objects.create(recipient=self.other, verb="review_new", message="not mine")

        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["unread_count"], 1)

    def test_mark_read_only_affects_own_notification(self):
        mine = Notification.objects.create(recipient=self.user, verb="review_new", message="a")
        response = self.client.post(f"/api/v1/notifications/{mine.id}/read/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mine.refresh_from_db()
        self.assertTrue(mine.is_read)

    def test_cannot_mark_someone_elses_notification_as_read(self):
        theirs = Notification.objects.create(recipient=self.other, verb="review_new", message="a")
        response = self.client.post(f"/api/v1/notifications/{theirs.id}/read/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        theirs.refresh_from_db()
        self.assertFalse(theirs.is_read)

    def test_mark_all_read_only_touches_own_unread_notifications(self):
        Notification.objects.create(recipient=self.user, verb="review_new", message="a")
        Notification.objects.create(recipient=self.user, verb="review_new", message="b")
        their_unread = Notification.objects.create(recipient=self.other, verb="review_new", message="c")

        response = self.client.post("/api/v1/notifications/mark-all-read/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(recipient=self.user, is_read=False).count(), 0)
        their_unread.refresh_from_db()
        self.assertFalse(their_unread.is_read)

    def test_list_requires_authentication(self):
        anon = APIClient()
        response = anon.get("/api/v1/notifications/")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
