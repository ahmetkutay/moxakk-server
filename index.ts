import express from 'express';
import dotenv from 'dotenv';
import { setupMiddleware } from './config/config';
import matchRoutes from './routes/match';
import connectDB from './config/db';
dotenv.config();

const app = express();
const port = 8080;

setupMiddleware(app);

connectDB();

app.use('/api', matchRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
