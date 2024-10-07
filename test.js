// Function to append text to a CSV file
import { appendFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';    

async function storeMemory(action, key, memory) {
    const filePath = join(process.cwd(), './functions/memories.csv');
    
    // Prepare the text as a CSV entry (with escaping of quotes)
    //const csvEntry = `"${memory.replace(/"/g, '""')}"\n`;

try {
    if (action === 'set') {
        await appendFile(filePath, `${key}, ${memory}\n`);
        console.log('Memory stored!'+ memory);
        return { [key]: memory };
    } else if (action == 'get') {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const lines = data.split('\n');
        for (const line of lines) {
            const [storedKey, storedMemory] = line.split(',');
            if (storedKey == key) {
                return { key: storedMemory };
            }
        }
        return { [key]: null };
    } else if (action == 'getall') {
        const data = await fs
            .promises.readFile(filePath, 'utf8')
            .catch(() => '');
        const memories = data   
            .split('\n')
            .map((line) => {
                const   [storedKey, storedMemory] = line.split(',');
                return { [storedKey]: storedMemory };
            });

        return memories;
    }
} catch (err) {
    console.error('Error writing to the file:', err);
}
 return `Memory Not stored! ${memory}`;
}
// Example usage (assuming an LLM would call this)
console.log( JSON.stringify(storeMemory("get","John")));
console.log( JSON.stringify(storeMemory("getall","Doe")));
console.log( JSON.stringify(storeMemory("set","John","Doe")));