# HRIS read API (contract double)

Reference data: `GET /reference-data` returns departments, locations, and positions.
A position is offered to the portal only when `open` and `internallyFillable` are both true.

Employment: `GET /employees/{employeeId}/employment` returns the current assignment,
position start date, employment status, probation, resignation flag, and line manager
reference. This read is not cached by the portal.
