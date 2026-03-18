import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import gradeRoutes from './routes/gradeRoutes.js';
import ocrRoutes, { ocrService } from './routes/ocrRoutes.js';
import planningRoutes from './routes/planningRoutes.js';
import scrapingRoutes from './routes/scrapingRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/ocr', ocrRoutes);
app.use('/api/v1/planning', planningRoutes);
app.use('/api/v1/scrape', scrapingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await ocrService.terminate();
  server.close(() => {
    process.exit(0);
  });
});

export default app;
