import { default as express } from 'express';
import { default as cors } from 'cors';

export const app = express();
const outputDirectory = process.env.OUTPUT_DIRECTORY || "./data/output";

app.use(express.json({ limit: '1gb' }));
app.use(cors());
app.use('/output', express.static(outputDirectory));

app.listen(process.env.API_PORT);