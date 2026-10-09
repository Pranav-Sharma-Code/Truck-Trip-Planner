from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("trips/plan/", views.plan_trip, name="plan-trip"),
    path("logs/check/", views.check_log_edits, name="check-logs"),
]
