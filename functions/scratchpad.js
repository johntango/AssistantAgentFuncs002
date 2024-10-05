import { appendFile } from 'fs/promises';
import { join } from 'path';
//import WordTokenizer from "natural.WordTokenizer";
import { OpenAI } from "openai";

const execute = async (memory, key, action) => {

    dotenv.config();
    // get OPENAI_API_KEY from GitHub secrets
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    


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
    // Example usage (assuming an LLM would call this)
    storeMemory(memory);
}
    
const details = {
    "name": "scratchpad",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "description": "action is one of set, get, getall or delete"
            },
            "key": {
                "type": "string",
                "description": "The key to the entity"
            },
            "memory": {
                "type": "string",
                "description": "The text to store"
            }
        },
        "required": ["key", "value","action"]
    },
    "description": "Given an entity action, key and memory, this function will store, get, list or delete the memory"
};
export { execute, details };