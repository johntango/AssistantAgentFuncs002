// Function to append text to a CSV file
import { appendFile } from 'fs/promises';
import { join } from 'path';

async function storeMemory(memory) {
    const filePath = join(process.cwd(), 'memories.csv');
    
        // Prepare the text as a CSV entry (with escaping of quotes)
        const csvEntry = `"${memory.replace(/"/g, '""')}"\n`;

        try {
            // Asynchronously append the text to the CSV file
            await appendFile(filePath, csvEntry, 'utf8');
            console.log('Memory successfully stored!');
        } catch (err) {
            console.error('Error writing to the file:', err);
        }
    }
    

// Example usage (assuming an LLM would call this)
storeMemory("Hello World");
