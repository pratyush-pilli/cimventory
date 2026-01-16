from rest_framework.permissions import BasePermission

class IsRequisitorOrApprover(BasePermission):
    def has_permission(self, request, view):
        # Ensure that the user is authenticated and the user has access to the division
        user = request.user
        division_id = view.kwargs.get('division_id')

        if user.division_id == int(division_id):
            # Allow Requisitors or Approvers
            if user.role in ['Requisitor', 'Approver']:
                return True
        return False