# Notification dispatch

The portal posts `{ templateId, locale: "en", recipient: { ref }, data }` to the notification platform.
`recipient.ref` is `employee:<id>` or `role:HR_BUSINESS_PARTNER`, never an email address.
`data` is limited to `referenceNo`, `requestId`, and `stageCode`. Delivery retries 429 and 5xx at most five times.
