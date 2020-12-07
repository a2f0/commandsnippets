from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """
    Object-level permission based on owner.
    """

    def has_object_permission(self, request, view, obj):
        return obj.user == request.user
