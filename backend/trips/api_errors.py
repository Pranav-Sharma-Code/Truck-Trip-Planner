import logging

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .exceptions import PlannerError

logger = logging.getLogger(__name__)


def _first_error(detail, field=None):
    """Return (field, message) for the first error in a DRF error structure."""
    if isinstance(detail, dict):
        for key, value in detail.items():
            return _first_error(value, field or key)  # keep the outermost field name
    if isinstance(detail, (list, tuple)) and detail:
        return _first_error(detail[0], field)
    return field, str(detail)


def api_exception_handler(exc, context):
    """Every error leaves the API as {"code", "message", "field"?}."""
    if isinstance(exc, PlannerError):
        body = {"code": exc.code, "message": exc.message}
        if exc.field:
            body["field"] = exc.field
        return Response(body, status=exc.status)

    if isinstance(exc, exceptions.ValidationError):
        field, message = _first_error(exc.detail)
        body = {"code": "validation_error", "message": message, "errors": exc.detail}
        if field:
            body["field"] = field
        return Response(body, status=400)

    if isinstance(exc, exceptions.Throttled):
        headers = {"Retry-After": str(int(exc.wait))} if exc.wait else None
        message = "Too many requests. Please wait a moment and try again."
        return Response({"code": "rate_limited", "message": message}, status=429, headers=headers)

    response = drf_exception_handler(exc, context)
    if response is not None:
        response.data = {"code": "request_error", "message": str(exc.detail)}
        return response

    logger.exception("Unhandled error while planning a trip", exc_info=exc)
    return Response({"code": "server_error", "message": "Something went wrong planning this trip."}, status=500)
