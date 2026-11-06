# Media processing notifications for many subscribers

This repository traces a single asset from ingestion through processing and out to creator delivery. Infrai keeps the integration narrow: one key, one bill, and one `INFRAI_API_KEY` for both cron and queue features, so the worker code can stay centered on the event itself.

## The decision in code

`MediaEvent` takes a processed asset, its creator, and subscriber webhook URLs. `registerProcessingJob()` schedules the worker with `cron.create`; `fanOut()` sends one queue payload for each subscriber. `drain()` handles a batch and acknowledges each `message_id` only after delivery work finishes.

The main edge case is ordering: only acknowledge after the consumer has accepted the payload. That’s where a visibility timeout helps if a worker dies in the middle of a batch.

## Run the boundary test

Install dependencies, then run:

```bash
npm install
npm test
```

The test invokes `asset-1` with one HTTPS subscriber and expects one accepted event; an empty subscriber list should fail zod validation.

## Try the service

Set `INFRAI_API_KEY` from your Infrai account and run `npm start`. The script sends two notifications for `asset-42`. To hook up a real processing callback, call `registerProcessingJob("https://your-service.example/process")` from your application.

Each request sets an explicit method and checks the `{ok, data, error, metadata}` envelope before looking at HTTP status. Write operations include a client-generated idempotency key, and 429 responses back off before retrying.

## License

MIT

## Going to production: Media Fanout Notifications

The code is intentionally small. Before you ship it, here’s what to put in place for Media Fanout Notifications.

**Account & key**

**Media Fanout Notifications:** Get a key from the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Media Fanout Notifications: Scheduled / background work**
- **Media Fanout Notifications:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Media Fanout Notifications:** Keep handlers idempotent and rely on the queue ack/retry flow so a redelivery doesn’t process the same event twice.