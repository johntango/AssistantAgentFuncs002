// server.js
import express, { response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import { URL } from 'url';
import { Console } from 'console';
import { openai, createAssistant, getFunctions, get_response, get_and_run_tool,get_run_status, } from './workers.js';

// Load environment variables
dotenv.config();

// Determine __dirname since it's not available in ES6 modules
const __filename = fileURLToPath(import.meta.url);

const app = express();
const port = 3002;

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.resolve(process.cwd(), './public')));



// Define global variables focus to keep track of the assistant, file, thread and run
let state = { chatgtp: true, assistant_id: "", assistant_name: "", dir_path: "", news_path: "", thread_id: "", user_message: "", run_id: "", run_status: "", vector_store_id: "", tools: [] };

// API endpoint to create or get an assistant
app.post('/api/assistant', async (req, res) => {
    state = req.body;
    let instructions = "you are a helpful agent";
    try {
        // create assistant 
        const assistant = await createAssistant(state.assistant_name,instructions);
        console.log("Got New assistant: " + assistant.id)
        if (assistant != null) {
            state.assistant_id = assistant.id;
            state.assistant_name = assistant.name;
            state.chatgtp = false;
        }

        let message = `got Assistant ${state.assistant_name} : ${JSON.stringify(assistant)}`;
        res.status(200).json({ "message": message, "state": state });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create or get assistant.', "state": state });
    }
});

app.post('/api/chatgpt', async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const chatCompletion = await openai.chat.completions.create({
          messages: [
            { role: 'system', content: "you are a helpful agent" },
            { role: 'user', content: prompt }
          ],
          model: 'gpt-3.5-turbo',
        });
        let message = chatCompletion.choices[0].message.content;
        console.log(message)
        res.json({ text: message });
      } catch (error) {
        console.error('Error calling OpenAI:', error);
        res.status(500).send('Error processing your request');
      }
});


// API endpoint to create a thread
app.post('/api/thread', async (req, res) => {
    state = req.body;
    try {
        let response = await create_thread();
        console.log("create_thread response: " + JSON.stringify(response));
        state.thread_id = response.id;
        res.status(200).json({ message: `got thread ${state.thread_id}`, "state": state });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Thread Create failed', "state": state });
    }
});
app.post('/api/prompt', async (req, res) => {
    // just update the state with the new prompt
    state = req.body;
    try {
        res.status(200).json({ message: `got prompt ${state.user_message}`, "state": state });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'User Message Failed', "state": state });
    }
});

// API endpoint to run the assistant
app.post('/api/run', async (req, res) => {
    state = req.body;
    try {
        if (state.chatgpt) {
            console.log("Running ChatGPT")
            let message = await run_chatgpt()
            res.status(200).json({ message: message, "state": state });
        }
        else{
            console.log("Running Assistant")
            let all_messages = await run_agent()
            res.status(200).json({ message: all_messages, state: state })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to run agent.', "state": state });
    }
});



async function get_assistant(name, instructions) {
    const response = await openai.beta.assistants.list({
        order: "desc",
        limit: 20,
    })
    // loop over all assistants and find the one with the name name
    let assistant = {};
    for (let obj in response.data) {
        assistant = response.data[obj];
        // change assistant.name to small letters
        if (assistant.name != null) {
            if (assistant.name.toLowerCase() == name.toLowerCase()) {
                state.assistant_id = assistant.id;
                state.tools = assistant.tools;  // get the tool
                break
            }
        }
    }
    if (state.assistant_id == "") {
        console.log("Creating new assistant")
        assistant = await create_assistant(name, instructions, tools)
    }
    return assistant;
}

// create a new thread

async function create_thread() {
    // do we need an intitial system message on the thread?
    let response = await openai.beta.threads.create(
        /*messages=[
        {
          "role": "user",
          "content": "Create data visualization based on the trends in this file.",
          "file_ids": [state.file_id]
        }
      ]*/
    )
    state.thread_id = response.id;
    return response;
}

// This V2 version works using AndPoll. It does not enable Function calls yet
async function run_agent() {
    let thread_id = state.thread_id;
    let assistant_id = state.assistant_id;
    console.log(`In run_agent state: ${JSON.stringify(state)}`)
    try {
        await openai.beta.threads.messages.create(thread_id,
            {
                role: "user",
                content: state.user_message
            })
        let run = await openai.beta.threads.runs.create(thread_id, {
            assistant_id: assistant_id
        })

        let run_id = run.id;
        state.run_id = run_id;

        // loop over the run status until it is completed
        let messages = await get_run_status(thread_id, run_id);
        console.log(`Run Finished: ${JSON.stringify(response)}`)
        
        
        return messages;
    }
    catch (error) {
        console.log(error);
        return error;
    }
}
    
async function run_chatgpt() {
    try {
        let message = state.user_message;
   
        const chatCompletion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: "you are a helpful agent" },
                { role: 'user', content: message },
            ],
            model: 'gpt-4o',
        });
        let response = chatCompletion.choices[0].message.content;
        console.log(`ChatGPT response: ${response}`)
        return response;
    }
    catch (error) {
        console.log(error);
        return error;
    }
}


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
export {state, get_assistant, create_thread, run_agent, run_chatgpt}