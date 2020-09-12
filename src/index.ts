require('dotenv').config();

import { db } from './initialiseDb';
import { performScans } from './scanner';

performScans().then(() => {
    console.log("Done");
});