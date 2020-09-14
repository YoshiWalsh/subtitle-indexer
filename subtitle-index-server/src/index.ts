require('dotenv').config();

import { db } from './initialiseDb';
import { performScans } from './scanner';
import { getFolders, search } from './api';

performScans().then(() => {
    console.log("Done");
});

getFolders();

search("percent", {file: [{libraryId: 2, filePath: 'Dr. Stone/'}]}).then(results => {
    console.log(results);
});