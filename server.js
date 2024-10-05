// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import { URL } from 'url';
import { Console } from 'console';

// Load environment variables
dotenv.config();

// Determine __dirname since it's not available in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Define global variables focus to keep track of the assistant, file, thread and run
let state = { assistant_id: "", assistant_name: "", dir_path: "", news_path: "", thread_id: "", user_message: "", run_id: "", run_status: "", vector_store_id: "" };

// API endpoint to create or get an assistant
app.post('/api/assistant', async (req, res) => {
    state = req.body;
    let instructions = ""
    try {
        const assistant = await get_assistant(state.assistant_name);
        console.log("Got assistant: " + assistant.id)
        if (assistant != null) {
            state.assistant_id = assistant.id;
            state.assistant_name = assistant.name;
        }

        let message = `got Assistant ${state.assistant_name} : ${JSON.stringify(assistant)}`;
        res.status(200).json({ "message": message, "state": state });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create or get assistant.', "state": state });
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
        let all_messages = await run_agent()
        res.status(200).json({ message: all_messages, state: state })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to run agent.', "state": state });
    }
});

let assistants = {}
//let tools = [{ role:"function", type: "code_interpreter" }, { role:"function",type: "retrieval" }]
let tools = [];


// requires action is a special case where we need to call a function
async function get_and_run_tool(response) {
   
}


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
                tools = assistant.tools;  // get the tool
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
    try {
        let thread_id = state.thread_id;
        let message = state.user_message;
        console.log(`In run_agent state: ${JSON.stringify(state)}`)
        await openai.beta.threads.messages.create(thread_id,
            {
                role: "user",
                content: message,
            })
        // run and poll thread V2 API feature
        let run = await openai.beta.threads.runs.createAndPoll(thread_id, {
            assistant_id: state.assistant_id
        })
        let run_id = run.id;
        state.run_id = run_id;

        // now retrieve the messages
        let messages = await openai.beta.threads.messages.list(thread_id);
        let all_messages = get_all_messages(messages);
        console.log(`Run Finished: ${JSON.stringify(all_messages)}`)
        return all_messages;
    }
    catch (error) {
        console.log(error);
        return error;
    }
}
async function get_all_messages(response) {
    let all_messages = [];
    let role = "";
    let content = "";
    for (let message of response.data) {
        // pick out role and content
        role = message.role;
        content = message.content[0].text.value;
        all_messages.push({ role, content });
    }
    return all_messages
}
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
