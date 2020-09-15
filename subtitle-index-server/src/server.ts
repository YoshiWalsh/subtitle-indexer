import { default as express } from 'express';

export const app = express();

app.use(express.json());

app.listen(process.env.API_PORT);