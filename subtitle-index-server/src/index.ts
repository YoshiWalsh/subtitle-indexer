require('dotenv').config();

import { db } from './initialiseDb';
import { performScans } from './scanner';
import './api';

async function scanLoop() {
    while(true) {
        await performScans();
        await new Promise(resolve => setTimeout(resolve, 1000*60*5));
    }
}

scanLoop().then(() => {
    console.log("The end of eternity has been reached");
}, err => {
    console.error("Scan loop exited with error", err);
});