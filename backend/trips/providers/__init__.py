from django.conf import settings

from .ors import OrsClient


def get_providers():
    """Return (geocoder, router); both are the same OpenRouteService client."""
    client = OrsClient(settings.ORS_API_KEY)
    return client, client
