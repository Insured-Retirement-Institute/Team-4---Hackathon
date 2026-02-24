const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();

app.use(express.json({ limit: '5mb' }));

// Swagger UI
const swaggerDoc = YAML.load(path.resolve(__dirname, '../Assets/annuity-eapp-openapi-3.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Routes
const applicationRoutes = require('./routes/application');
const validationRoutes = require('./routes/validation');
const submissionRoutes = require('./routes/submission');
const productRoutes = require('./routes/products');
const applicationsRoutes = require('./routes/applications');

app.use('/application', applicationRoutes);
app.use('/application', validationRoutes);
app.use('/application', submissionRoutes);
app.use('/products', productRoutes);
app.use('/applications', applicationsRoutes);

module.exports = app;
