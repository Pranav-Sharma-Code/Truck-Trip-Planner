from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from .geo.places import get_place_index
from .providers import get_fuel_finder, get_providers
from .serializers import TripRequestSerializer
from .services.planner import build_trip_plan


@api_view(["GET"])
@throttle_classes([])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def plan_trip(request):
    serializer = TripRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    geocoder, router = get_providers()
    plan = build_trip_plan(
        serializer.validated_data, geocoder, router, get_place_index(), fuel_finder=get_fuel_finder()
    )
    return Response(plan)
