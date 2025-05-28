import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';

import { ASCII_LOGO, SERVER_READY } from './config/ascii';
import { errorHandler } from './middleware';
import router from './routes';

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(ASCII_LOGO);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1', router);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(SERVER_READY(port));
});
