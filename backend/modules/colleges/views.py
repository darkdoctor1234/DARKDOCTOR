from django.db import transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    College, SeatEntry, FeeEntry, StipendEntry,
    Review, ReviewReport, ReviewHelpful,
    Question, Answer, QuestionReport, AnswerReport, ModerationStatus,
)
from modules.accounts.models import User
from modules.notifications.services import notify, notify_many
from .serializers import (
    CollegeListSerializer,
    CollegeSerializer,
    CollegeWriteSerializer,
    SeatEntrySerializer,
    FeeEntrySerializer,
    StipendEntrySerializer,
    ReviewSerializer,
    ReviewAdminSerializer,
    ReviewCreateSerializer,
    ReviewReportSerializer,
    QuestionSerializer,
    QuestionAdminSerializer,
    QuestionCreateSerializer,
    AnswerSerializer,
    AnswerAdminSerializer,
    AnswerCreateSerializer,
    QuestionReportSerializer,
    AnswerReportSerializer,
)
from .bulk_import import generate_template, parse_and_import
from modules.authentication.permissions import IsSuperAdmin, IsAdmin

# ── shared prefetch queryset ──────────────────────────────────────────────────
# avg_rating / review_count are aggregated from visible reviews' overall-rating
# field (a stand-in for the review's 5-category average, cheap to aggregate in
# SQL) — used for the star rating shown on directory list cards.
#
# Built fresh on every call, not hoisted to a module-level constant: the list
# view below returns this queryset unfiltered and unpaginated straight to the
# serializer, so a shared instance would have its results cached (Django's
# QuerySet._result_cache) the first time anyone hit GET /colleges/, and every
# request after that — for the lifetime of the worker process — would keep
# returning that one frozen snapshot, silently hiding every college added
# afterward until the process restarted.
def _college_list_queryset():
    return College.objects.prefetch_related("departments").annotate(
        avg_rating=Avg("reviews__rating_overall", filter=Q(reviews__status=Review.Status.VISIBLE)),
        review_count=Count("reviews", filter=Q(reviews__status=Review.Status.VISIBLE)),
    ).all()

_COLLEGE_QUERYSET = College.objects.prefetch_related(
    "departments", "seat_entries", "fee_entries", "stipend_entries"
).all()


class CollegeListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        if self.request.method == "GET":
            return _college_list_queryset()
        return _COLLEGE_QUERYSET

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return CollegeWriteSerializer
        return CollegeListSerializer


class CollegeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = _COLLEGE_QUERYSET

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CollegeWriteSerializer
        return CollegeSerializer


# ── helpers ───────────────────────────────────────────────────────────────────

def _validate_finance_rows(data) -> list[str]:
    """
    Validate a list of finance-entry objects (fee or stipend).
    Returns a list of error strings; empty list means all rows are valid.

    Rejects floats (1.7 → error), accepts integral floats (1.0 → OK),
    rejects negatives, rejects non-numeric strings.
    """
    errors: list[str] = []
    if not isinstance(data, list):
        return ["Request body must be a JSON array."]

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"Row {i + 1}: must be an object.")
            continue
        if not str(item.get("program", "")).strip():
            errors.append(f"Row {i + 1}: 'program' is required.")
        amount = item.get("amount")
        try:
            amount_int = int(amount)
            # Reject floats with fractional parts (e.g. 1.7 → error; 1.0 → ok)
            if amount_int != amount:
                raise ValueError("not a whole number")
            if amount_int < 0:
                raise ValueError("negative")
        except (TypeError, ValueError):
            errors.append(f"Row {i + 1}: 'amount' must be a non-negative whole number (got {amount!r}).")

    return errors


# ── Seat entries ──────────────────────────────────────────────────────────────

class SeatEntryBulkUpdateView(APIView):
    """
    GET  /colleges/{pk}/seats/  — public read, returns seat entries for the college.
    PUT  /colleges/{pk}/seats/  — super-admin only; atomically replaces all entries.

    PUT body: JSON array of objects, e.g.
        [
          {"program": "MBBS",  "department": "",                "seats": 20, "display_order": 0},
          {"program": "PG",    "department": "General Surgery", "seats": 10, "display_order": 1},
        ]

    Sending an empty array [] clears all entries.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        entries = SeatEntry.objects.filter(college=college)
        return Response(SeatEntrySerializer(entries, many=True).data)

    def put(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        data    = request.data

        if not isinstance(data, list):
            return Response({"error": "Request body must be a JSON array."}, status=400)

        errors = []
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                errors.append(f"Row {i + 1}: must be an object.")
                continue
            if not str(item.get("program", "")).strip():
                errors.append(f"Row {i + 1}: 'program' is required.")
            seats = item.get("seats")
            try:
                seats_int = int(seats)
                if seats_int < 0:
                    raise ValueError
            except (TypeError, ValueError):
                errors.append(f"Row {i + 1}: 'seats' must be a whole number ≥ 0.")

        if errors:
            return Response({"errors": errors}, status=400)

        with transaction.atomic():
            SeatEntry.objects.filter(college=college).delete()
            SeatEntry.objects.bulk_create([
                SeatEntry(
                    college=college,
                    program=str(item["program"]).strip(),
                    department=str(item.get("department", "")).strip(),
                    seats=int(item["seats"]),
                    display_order=int(item.get("display_order", i)),
                )
                for i, item in enumerate(data)
            ])

        entries = SeatEntry.objects.filter(college=college)
        return Response(SeatEntrySerializer(entries, many=True).data)


# ── Fee entries ───────────────────────────────────────────────────────────────

class FeeEntryBulkUpdateView(APIView):
    """
    GET  /colleges/{pk}/fees/  — public read, returns fee entries for the college.
    PUT  /colleges/{pk}/fees/  — super-admin only; atomically replaces all entries.

    PUT body: JSON array of objects, e.g.
        [
          {"program": "MBBS",    "department": "",            "amount": 150000, "display_order": 0},
          {"program": "Dental",  "department": "",            "amount": 80000,  "display_order": 1},
          {"program": "PG",      "department": "Cardiology",  "amount": 200000, "display_order": 2},
        ]

    Amounts are annual fees in INR (whole rupees). Sending [] clears all entries.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        entries = FeeEntry.objects.filter(college=college)
        return Response(FeeEntrySerializer(entries, many=True).data)

    def put(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        data    = request.data

        errors = _validate_finance_rows(data)
        if errors:
            return Response({"errors": errors}, status=400)

        with transaction.atomic():
            FeeEntry.objects.filter(college=college).delete()
            FeeEntry.objects.bulk_create([
                FeeEntry(
                    college=college,
                    program=str(item["program"]).strip(),
                    department=str(item.get("department", "")).strip(),
                    amount=int(item["amount"]),
                    display_order=int(item.get("display_order", i)),
                )
                for i, item in enumerate(data)
            ])

        entries = FeeEntry.objects.filter(college=college)
        return Response(FeeEntrySerializer(entries, many=True).data)


# ── Stipend entries ───────────────────────────────────────────────────────────

class StipendEntryBulkUpdateView(APIView):
    """
    GET  /colleges/{pk}/stipends/  — public read, returns stipend entries for the college.
    PUT  /colleges/{pk}/stipends/  — super-admin only; atomically replaces all entries.

    PUT body: JSON array of objects, e.g.
        [
          {"program": "PG",  "department": "",            "amount": 50000, "display_order": 0},
          {"program": "PG",  "department": "Cardiology",  "amount": 75000, "display_order": 1},
        ]

    Amounts are monthly stipends in INR (whole rupees). Sending [] clears all entries.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        entries = StipendEntry.objects.filter(college=college)
        return Response(StipendEntrySerializer(entries, many=True).data)

    def put(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        data    = request.data

        errors = _validate_finance_rows(data)
        if errors:
            return Response({"errors": errors}, status=400)

        with transaction.atomic():
            StipendEntry.objects.filter(college=college).delete()
            StipendEntry.objects.bulk_create([
                StipendEntry(
                    college=college,
                    program=str(item["program"]).strip(),
                    department=str(item.get("department", "")).strip(),
                    amount=int(item["amount"]),
                    display_order=int(item.get("display_order", i)),
                )
                for i, item in enumerate(data)
            ])

        entries = StipendEntry.objects.filter(college=college)
        return Response(StipendEntrySerializer(entries, many=True).data)


# ── Bulk import ───────────────────────────────────────────────────────────────

class CollegeBulkImportTemplateView(APIView):
    """GET — returns the Excel import template as a download."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        try:
            file_bytes = generate_template()
        except Exception as exc:
            return Response({"error": str(exc)}, status=500)

        response = HttpResponse(
            file_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="darkdoctor_colleges_template.xlsx"'
        return response


class CollegeBulkImportView(APIView):
    """POST — accepts an Excel file and bulk-imports colleges."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file received. Please attach an Excel file."}, status=400)

        try:
            results = parse_and_import(uploaded)
        except (ValueError, RuntimeError) as exc:
            return Response({"error": str(exc)}, status=400)
        except Exception as exc:
            return Response({"error": f"Unexpected error: {exc}"}, status=500)

        status_code = 200 if results["imported"] > 0 else 422
        return Response(results, status=status_code)


# ── Reviews ───────────────────────────────────────────────────────────────────

AUTO_HIDE_THRESHOLD = 5   # hide review after this many reports


class CollegeReviewListCreateView(APIView):
    """
    GET  /colleges/{pk}/reviews/  — public, returns all visible reviews for a college.
    POST /colleges/{pk}/reviews/  — authenticated users only; one review per user per college.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        reviews = (
            Review.objects
            .filter(college=college, status=Review.Status.VISIBLE)
            .select_related("user")
            .prefetch_related("images")
            .order_by("-created_at")
        )
        serializer = ReviewSerializer(reviews, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, pk):
        college = get_object_or_404(College, pk=pk)

        # Only allow users whose profile links to this college
        try:
            profile = request.user.profile
            allowed_ids = set(filter(None, [
                profile.ug_college_id,
                profile.pg_college_id,
            ]))
        except Exception:
            allowed_ids = set()

        if not allowed_ids:
            return Response(
                {"detail": "Complete your profile with your college before writing a review."},
                status=403,
            )
        if college.id not in allowed_ids:
            return Response(
                {"detail": "You can only review colleges you are affiliated with (your UG or PG college)."},
                status=403,
            )

        # One review per user per college — but a rejected review can be edited
        # and resubmitted (see ReviewResubmitView) rather than creating a new row.
        existing = Review.objects.filter(college=college, user=request.user).first()
        if existing:
            if existing.status == Review.Status.REJECTED:
                return Response({
                    "detail": "Your previous review for this college was rejected. Edit and resubmit it instead of writing a new one.",
                    "existing_review_id": existing.id,
                    "existing_status": "rejected",
                    "rejection_reason": existing.rejection_reason,
                }, status=400)
            if existing.status == Review.Status.PENDING:
                return Response({
                    "detail": "Your review for this college is still awaiting admin approval.",
                    "existing_review_id": existing.id,
                    "existing_status": "pending",
                }, status=400)
            return Response({
                "detail": "You have already submitted a review for this college.",
                "existing_review_id": existing.id,
                "existing_status": existing.status,
            }, status=400)

        serializer = ReviewCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        review = serializer.save(college=college, user=request.user)
        return Response(
            ReviewSerializer(review, context={"request": request}).data,
            status=201,
        )


class ReviewResubmitView(APIView):
    """PATCH /colleges/reviews/{pk}/resubmit/ — the review's own author edits and
    resubmits a rejected review. Reuses the same row (see ReviewCreateSerializer.update)
    instead of creating a second one, so the one-review-per-college rule still holds."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)
        if review.status != Review.Status.REJECTED:
            return Response({"detail": "Only a rejected review can be resubmitted."}, status=400)

        serializer = ReviewCreateSerializer(review, data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        review = serializer.save()
        return Response(ReviewSerializer(review, context={"request": request}).data)


class ReviewHelpfulView(APIView):
    """POST /colleges/reviews/{pk}/helpful/ — toggle helpful on a review."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk, status=Review.Status.VISIBLE)

        vote, created = ReviewHelpful.objects.get_or_create(review=review, user=request.user)
        if created:
            Review.objects.filter(pk=pk).update(helpful_count=review.helpful_count + 1)
            notify(
                review.user, "review_helpful",
                f"Someone found your review of {review.college.name} helpful.",
                url=f"/colleges/{review.college_id}", actor=request.user,
            )
            return Response({"helpful": True,  "helpful_count": review.helpful_count + 1})
        else:
            vote.delete()
            count = max(review.helpful_count - 1, 0)
            Review.objects.filter(pk=pk).update(helpful_count=count)
            return Response({"helpful": False, "helpful_count": count})


class ReviewReportView(APIView):
    """POST /colleges/reviews/{pk}/report/ — report a review."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk)

        if ReviewReport.objects.filter(review=review, reporter=request.user).exists():
            return Response({"detail": "You have already reported this review."}, status=400)

        serializer = ReviewReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            ReviewReport.objects.create(
                review=review,
                reporter=request.user,
                **serializer.validated_data,
            )
            new_count = review.report_count + 1
            Review.objects.filter(pk=pk).update(report_count=new_count)

            # Auto-flag at threshold
            if new_count >= AUTO_HIDE_THRESHOLD:
                Review.objects.filter(pk=pk).update(status=Review.Status.FLAGGED)

        return Response({"detail": "Review reported. Thank you for your feedback."})


class ReviewPendingListView(generics.ListAPIView):
    """GET /colleges/reviews/pending/ — admin/super-admin queue of newly submitted
    reviews awaiting their first-ever approval decision (with real name/email)."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class   = ReviewAdminSerializer

    def get_queryset(self):
        return (
            Review.objects
            .filter(status=Review.Status.PENDING)
            .select_related("user", "college", "resolved_by")
            .prefetch_related("images")
            .order_by("created_at")  # oldest first — first in, first reviewed
        )


class ReviewAdminListView(generics.ListAPIView):
    """GET /colleges/reviews/flagged/ — admin/super-admin sees all reported
    (already-published, now over the report threshold) reviews (with real name/email)."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class   = ReviewAdminSerializer

    def get_queryset(self):
        return (
            Review.objects
            .filter(status=Review.Status.FLAGGED)
            .select_related("user", "college", "resolved_by")
            .prefetch_related("images")
            .order_by("-report_count")
        )


class ReviewHistoryListView(generics.ListAPIView):
    """GET /colleges/reviews/history/ — recently resolved reviews (approved,
    rejected or removed), for the super-admin oversight view of what admins
    have been deciding. Not surfaced in the regular admin queue UI."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class   = ReviewAdminSerializer

    def get_queryset(self):
        return (
            Review.objects
            .filter(resolved_by__isnull=False)
            .select_related("user", "college", "resolved_by")
            .prefetch_related("images")
            .order_by("-updated_at")[:100]
        )


class ReviewAdminActionView(APIView):
    """PATCH /colleges/reviews/{pk}/admin/ — approve, reject (with a reason,
    pending reviews only) or remove (reported reviews) a review."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        action = request.data.get("action")  # "approve", "reject" or "remove"

        if action == "approve":
            review.status = Review.Status.VISIBLE
            review.rejection_reason = ""
            review.resolved_by = request.user
            review.save(update_fields=["status", "rejection_reason", "resolved_by"])
            notify(
                review.user, "review_approved",
                f"Your review of {review.college.name} was approved and is now live.",
                url=f"/colleges/{review.college_id}", actor=request.user,
            )
            linked_users = User.objects.filter(
                Q(profile__ug_college_id=review.college_id) | Q(profile__pg_college_id=review.college_id)
            ).exclude(pk=review.user_id)
            notify_many(
                linked_users, "review_new",
                f"A new review was posted for {review.college.name}.",
                url=f"/colleges/{review.college_id}", actor=review.user,
            )
            return Response({"detail": "Review approved."})
        elif action == "reject":
            reason = (request.data.get("reason") or "").strip()
            if not reason:
                return Response({"detail": "A rejection reason is required."}, status=400)
            review.status = Review.Status.REJECTED
            review.rejection_reason = reason
            review.resolved_by = request.user
            review.save(update_fields=["status", "rejection_reason", "resolved_by"])
            notify(
                review.user, "review_rejected",
                f"Your review of {review.college.name} was rejected: {reason}",
                url=f"/colleges/{review.college_id}", actor=request.user,
            )
            return Response({"detail": "Review rejected."})
        elif action == "remove":
            review.status = Review.Status.REMOVED
            review.resolved_by = request.user
            review.save(update_fields=["status", "resolved_by"])
            return Response({"detail": "Review removed."})
        return Response({"detail": "action must be 'approve', 'reject' or 'remove'."}, status=400)


class MyReviewsView(generics.ListAPIView):
    """GET /colleges/reviews/mine/ — returns all reviews written by the current user (includes own name/email)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ReviewAdminSerializer

    def get_queryset(self):
        return (
            Review.objects
            .filter(user=self.request.user)
            .select_related("user", "college")
            .prefetch_related("images")
            .order_by("-created_at")
        )


class TrendingReviewsView(APIView):
    """GET /colleges/reviews/trending/ — public; most helpful reviews this week."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.utils import timezone
        import datetime
        week_ago = timezone.now() - datetime.timedelta(days=7)
        reviews = (
            Review.objects
            .filter(status=Review.Status.VISIBLE, created_at__gte=week_ago)
            .select_related("user", "college")
            .prefetch_related("images")
            .order_by("-helpful_count", "-created_at")[:20]
        )
        return Response(ReviewSerializer(reviews, many=True, context={"request": request}).data)


class RecentReviewsView(APIView):
    """GET /colleges/reviews/recent/ — public; latest reviews across all colleges."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        reviews = (
            Review.objects
            .filter(status=Review.Status.VISIBLE)
            .select_related("user", "college")
            .prefetch_related("images")
            .order_by("-created_at")[:20]
        )
        return Response(ReviewSerializer(reviews, many=True, context={"request": request}).data)


# ── Q&A / Discussions ────────────────────────────────────────────────────────

_QUESTION_QUERYSET = Question.objects.select_related("user", "college").prefetch_related("answers")


class QuestionListCreateView(APIView):
    """
    GET  /colleges/{pk}/questions/  — public; questions & discussions for a college.
                                       Optional ?kind=question|discussion filter.
    POST /colleges/{pk}/questions/  — authenticated users only.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        qs = _QUESTION_QUERYSET.filter(college=college, status=ModerationStatus.VISIBLE)
        kind = request.query_params.get("kind")
        if kind in (Question.Kind.QUESTION, Question.Kind.DISCUSSION):
            qs = qs.filter(kind=kind)
        return Response(QuestionSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request, pk):
        college = get_object_or_404(College, pk=pk)
        serializer = QuestionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        question = serializer.save(college=college, user=request.user)
        return Response(QuestionSerializer(question, context={"request": request}).data, status=201)


class MyQuestionsView(generics.ListAPIView):
    """GET /colleges/questions/mine/ — current user's own questions & discussions."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = QuestionSerializer

    def get_queryset(self):
        return _QUESTION_QUERYSET.filter(user=self.request.user)


class QuestionDetailView(generics.RetrieveAPIView):
    """GET /colleges/questions/{pk}/ — public; a single question (for its own detail/answers page)."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = QuestionSerializer
    queryset           = _QUESTION_QUERYSET.filter(status=ModerationStatus.VISIBLE)


class QuestionAnswerListCreateView(APIView):
    """
    GET  /colleges/questions/{pk}/answers/  — public; answers for a question.
    POST /colleges/questions/{pk}/answers/  — authenticated users only.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        answers = question.answers.filter(status=ModerationStatus.VISIBLE).select_related("user")
        return Response(AnswerSerializer(answers, many=True, context={"request": request}).data)

    def post(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        serializer = AnswerCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        answer = serializer.save(question=question, user=request.user)

        url = f"/colleges/{question.college_id}/questions/{question.id}"
        if question.kind == Question.Kind.DISCUSSION:
            participant_ids = set(question.answers.exclude(user_id=request.user.id).values_list("user_id", flat=True))
            participant_ids.add(question.user_id)
            participant_ids.discard(request.user.id)
            notify_many(
                User.objects.filter(pk__in=participant_ids), "discussion_reply",
                f'New reply in "{question.title}"', url=url, actor=request.user,
            )
        else:
            notify(
                question.user, "answer_new",
                f'Your question "{question.title}" got a new answer.',
                url=url, actor=request.user,
            )
        return Response(AnswerSerializer(answer, context={"request": request}).data, status=201)


# ── Q&A reporting & moderation ──────────────────────────────────────────────
# Same shape as Review's report/admin views above, but no pending-approval
# step — Q&A is live the moment it's posted (like Community content), so
# there's only ever approve (un-flag) or remove, never reject.

class QuestionReportView(APIView):
    """POST /colleges/questions/{pk}/report/ — report a question or discussion."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        question = get_object_or_404(Question, pk=pk)

        if QuestionReport.objects.filter(question=question, reporter=request.user).exists():
            return Response({"detail": "You have already reported this question."}, status=400)

        serializer = QuestionReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            QuestionReport.objects.create(question=question, reporter=request.user, **serializer.validated_data)
            new_count = question.report_count + 1
            Question.objects.filter(pk=pk).update(report_count=new_count)
            if new_count >= AUTO_HIDE_THRESHOLD:
                Question.objects.filter(pk=pk).update(status=ModerationStatus.FLAGGED)

        return Response({"detail": "Reported. Thank you for your feedback."})


class AnswerReportView(APIView):
    """POST /colleges/answers/{pk}/report/ — report an answer."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        answer = get_object_or_404(Answer, pk=pk)

        if AnswerReport.objects.filter(answer=answer, reporter=request.user).exists():
            return Response({"detail": "You have already reported this answer."}, status=400)

        serializer = AnswerReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            AnswerReport.objects.create(answer=answer, reporter=request.user, **serializer.validated_data)
            new_count = answer.report_count + 1
            Answer.objects.filter(pk=pk).update(report_count=new_count)
            if new_count >= AUTO_HIDE_THRESHOLD:
                Answer.objects.filter(pk=pk).update(status=ModerationStatus.FLAGGED)

        return Response({"detail": "Reported. Thank you for your feedback."})


class QuestionAdminListView(generics.ListAPIView):
    """GET /colleges/questions/flagged/ — admin/super-admin queue of reported questions."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class   = QuestionAdminSerializer

    def get_queryset(self):
        return (
            Question.objects
            .filter(status=ModerationStatus.FLAGGED)
            .select_related("user", "college")
            .order_by("-report_count")
        )


class AnswerAdminListView(generics.ListAPIView):
    """GET /colleges/answers/flagged/ — admin/super-admin queue of reported answers."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class   = AnswerAdminSerializer

    def get_queryset(self):
        return (
            Answer.objects
            .filter(status=ModerationStatus.FLAGGED)
            .select_related("user", "question", "question__college")
            .order_by("-report_count")
        )


class QuestionAdminActionView(APIView):
    """PATCH /colleges/questions/{pk}/admin/ — approve (un-flag) or remove a reported question."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        action = request.data.get("action")  # "approve" or "remove"

        if action == "approve":
            question.status = ModerationStatus.VISIBLE
            question.save(update_fields=["status"])
            return Response({"detail": "Question approved."})
        elif action == "remove":
            question.status = ModerationStatus.REMOVED
            question.save(update_fields=["status"])
            return Response({"detail": "Question removed."})
        return Response({"detail": "action must be 'approve' or 'remove'."}, status=400)


class AnswerAdminActionView(APIView):
    """PATCH /colleges/answers/{pk}/admin/ — approve (un-flag) or remove a reported answer."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        answer = get_object_or_404(Answer, pk=pk)
        action = request.data.get("action")  # "approve" or "remove"

        if action == "approve":
            answer.status = ModerationStatus.VISIBLE
            answer.save(update_fields=["status"])
            return Response({"detail": "Answer approved."})
        elif action == "remove":
            answer.status = ModerationStatus.REMOVED
            answer.save(update_fields=["status"])
            return Response({"detail": "Answer removed."})
        return Response({"detail": "action must be 'approve' or 'remove'."}, status=400)
