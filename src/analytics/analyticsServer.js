const express = require('express');
const { register } = require('./prometheusClient');

function createMetricsServer(port = 9090) {
    const app = express();

   
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Metrics endpoint for Prometheus
    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType);
            const metrics = await register.metrics();
            res.end(metrics);
        } catch (error) {
            res.status(500).end(error);
        }
    });

    const server = app.listen(port, () => {
        console.log(`📊 Metrics server listening on port ${port}`);
    });

    return server;
}

module.exports = { createMetricsServer };