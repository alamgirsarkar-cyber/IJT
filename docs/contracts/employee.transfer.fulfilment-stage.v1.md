# Fulfilment webhooks

`POST /api/v1/internal-transfers/webhooks/stage-completion` is HMAC-SHA256 over the five-line canonical string. Delivery of outbound fulfilment events is at-least-once. Consumers dedupe on `requestId` and `stageCode`.

`outcome: SUCCESS` means the downstream business operation finished. Ticket intake is not success.
