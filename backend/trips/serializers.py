import math
from datetime import datetime

from rest_framework import serializers

MAX_LOCATION_LENGTH = 200


class TripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    pickup_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    dropoff_location = serializers.CharField(max_length=MAX_LOCATION_LENGTH)
    current_cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.CharField(required=False, allow_null=True)

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
