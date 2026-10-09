import math
from datetime import datetime

from rest_framework import serializers

MAX_LOCATION_LENGTH = 200
COUNTRY_PATTERN = r"^[A-Za-z]{2}$"


class AddressPartsField(serializers.DictField):

    ALLOWED = {"place", "area", "region", "postal"}

    def __init__(self, **kwargs):
        super().__init__(child=serializers.CharField(allow_blank=True, max_length=MAX_LOCATION_LENGTH), **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        unknown = set(value) - self.ALLOWED
        if unknown:
            raise serializers.ValidationError(f"Unknown address parts: {', '.join(sorted(unknown))}.")
        return value


DUTY_STATUSES = ("OFF_DUTY", "SLEEPER_BERTH", "DRIVING", "ON_DUTY_NOT_DRIVING")
MINUTES_PER_DAY = 24 * 60


class LogSegmentSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=DUTY_STATUSES)
    start_minute = serializers.IntegerField(min_value=0, max_value=MINUTES_PER_DAY - 1)
    end_minute = serializers.IntegerField(min_value=1, max_value=MINUTES_PER_DAY)


class LogDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    segments = LogSegmentSerializer(many=True, allow_empty=False, max_length=96)

    def validate_segments(self, segments):
        """A day sheet covers midnight to midnight with no gaps or overlaps."""
        expected = 0
        for segment in segments:
            if segment["start_minute"] != expected or segment["end_minute"] <= segment["start_minute"]:
                raise serializers.ValidationError(
                    "Segments must run from 00:00 to 24:00 in order, with no gaps or overlaps."
                )
            expected = segment["end_minute"]
        if expected != MINUTES_PER_DAY:
            raise serializers.ValidationError("Segments must run from 00:00 to 24:00.")
        return segments


class LogCheckSerializer(serializers.Serializer):
    """An edited set of daily logs, to be checked against the hours-of-service rules."""

    utc_offset = serializers.RegexField(r"^[+-]\d{2}:\d{2}$")
    cycle_used_start_hours = serializers.FloatField(min_value=0, max_value=70, default=0)
    days = LogDaySerializer(many=True, allow_empty=False, max_length=31)

    def validate_days(self, days):
        dates = [day["date"] for day in days]
        if dates != sorted(set(dates)) or any(
            (later - earlier).days != 1 for earlier, later in zip(dates, dates[1:])
        ):
            raise serializers.ValidationError("Days must be consecutive calendar dates, in order.")
        return days


class TripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    pickup_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    dropoff_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    # Optional ISO 3166-1 alpha-2 country per place; narrows the search to that country.
    current_country = serializers.RegexField(COUNTRY_PATTERN, required=False, allow_blank=True, allow_null=True)
    pickup_country = serializers.RegexField(COUNTRY_PATTERN, required=False, allow_blank=True, allow_null=True)
    dropoff_country = serializers.RegexField(COUNTRY_PATTERN, required=False, allow_blank=True, allow_null=True)
    # Optional address parts per place; lets the geocoder try the most specific search first.
    current_parts = AddressPartsField(required=False)
    pickup_parts = AddressPartsField(required=False)
    dropoff_parts = AddressPartsField(required=False)
    current_cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.CharField(required=False, allow_null=True)

    def _country(self, value):
        return value.upper() if value else None

    def validate_current_country(self, value):
        return self._country(value)

    def validate_pickup_country(self, value):
        return self._country(value)

    def validate_dropoff_country(self, value):
        return self._country(value)

    def validate_current_cycle_used_hours(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Enter a number between 0 and 70.")
        return value

    def validate_start_time(self, value):
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            raise serializers.ValidationError("Use an ISO 8601 date and time, e.g. 2026-10-08T06:00:00-05:00.")
        if parsed.tzinfo is None:
            raise serializers.ValidationError("Include a UTC offset, e.g. 2026-10-08T06:00:00-05:00.")
        return parsed
