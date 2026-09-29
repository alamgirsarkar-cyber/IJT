# employee.transfer.requested.v1

Delivery is at-least-once. Consumers dedupe on `requestId`.

Payload allow-list: `requestId`, `referenceNo`, `employeeId`, current and target
department, location, position, grade and cost centre, `requestedEffectiveDate`,
`applicableStageCodes`, `submittedAt`, `correlationId`.

The payload has no reason text, no names and no contact details.
