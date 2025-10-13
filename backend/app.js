import express from 'express';
import cors from 'cors';

// Import routes
import rankingRoute from './route/RankingRoute.js';
import createGameRoom from './route/createRoomRoute.js';
const app = express();

// Configure CORS for Express
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));

// Basic middleware
app.use(express.json());                        // Cho JSON data
app.use(express.urlencoded({ extended: true })); // Cho form-urlencoded

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Card Game Server is running' });
});

// API Routes
app.use('/api', rankingRoute);

// REST API Routes - PostgreSQL integration
app.use("/api/room", createGameRoom);
export default app;