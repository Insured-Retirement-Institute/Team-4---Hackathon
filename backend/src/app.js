const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger UI
const swaggerDoc = YAML.load(path.resolve(__dirname, '../Assets/annuity-eapp-openapi-3.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Routes
const docusignRoutes = require('./routes/docusign');
const validationRoutes = require('./routes/validation');
const submissionRoutes = require('./routes/submission');
const productRoutes = require('./routes/products');
const applicationsRoutes = require('./routes/applications');
const distributorRoutes = require('./routes/distributors');

app.use('/applications', docusignRoutes);
app.use('/applications', validationRoutes);
app.use('/applications', submissionRoutes);
app.use('/products', productRoutes);
app.use('/applications', applicationsRoutes);
app.use('/distributors', distributorRoutes);

module.exports = app;
