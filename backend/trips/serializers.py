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
