class PlannerError(Exception):
  

    status = 500
    code = "planner_error"

    def __init__(self, message, field=None):
        super().__init__(message)
        self.message = message
        self.field = field


class LocationNotFound(PlannerError):
    status = 422
    code = "location_not_found"


class RouteNotFound(PlannerError):
    status = 422
    code = "route_not_found"


class ProviderBusy(PlannerError):
    status = 503
    code = "provider_busy"


class RoutingFailed(PlannerError):
    status = 502
    code = "routing_failed"
