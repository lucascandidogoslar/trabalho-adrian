const express = require('express');
const promClient = require('prom-client');

// Create a Registry and default metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metric example: "jobs_processed_total"
// You can "observe" it via POST /job or GET /work.
const jobsCounter = new promClient.Counter({
  name: 'jobs_processed_total',
  help: 'Total number of fake jobs processed by the service',
  labelNames: ['source']
});
register.registerMetric(jobsCounter);

// Another example: request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

const app = express();
app.use(express.json());

// Simple middleware to time requests
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    end({ status_code: res.statusCode });
  });
  next();
});

app.get('/', (_req, res) => {
  res.json({
    message: 'Hello from Node + Prometheus demo!',
    try: ['/metrics', '/work', 'POST /job {"source":"api"}']
  });
});

app.get('/health', (_req, res) => res.status(200).send('OK'));

app.get('/work', (_req, res) => {
  jobsCounter.inc({ source: 'manual' });
  res.json({ processed: true });
});

app.post('/job', (req, res) => {
  const source = (req.body && req.body.source) || 'api';
  jobsCounter.inc({ source });
  res.json({ enqueued: true, source });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`App listening on ${port}`));