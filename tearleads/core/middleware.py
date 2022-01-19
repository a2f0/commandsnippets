import configparser

from django.conf import settings


class ApiVersion:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        config = configparser.RawConfigParser()
        config.read("setup.cfg")
        response["API-Version"] = settings.VERSION
        return response
