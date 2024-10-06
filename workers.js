import fs from 'fs';
import { Server, get } from 'http';
import path from 'path';
import {state} from './server.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
async function createAssistant(name, instructions) {
    try {
        const functions = await getFunctions();

        let local_tools = [];
    // lets just add all the tools to the assistant
        //let tools = await get_tools(assistant_id);
        
        let keys = Object.keys(functions);
        for (let key of keys) {
            let details = functions[key].details;
            local_tools.push({ "type": "function", "function": details })
        }


        let assistant = await openai.beta.assistants.create({
            name: name,
            instructions: instructions,
            tools: local_tools,
            model: "gpt-4-1106-preview",
        });
        state.assistant_id = assistant.id
        state.assistant_name = name;
    
        return assistant;
    } catch (error) {
        console.log(error);
        return error;
    }
}   
async function getFunctions() {
   
    const files = fs.readdirSync(path.resolve(process.cwd(), "./functions"));
    const openAIFunctions = [];

    for (const file of files) {
        if (file.endsWith(".js")) {
            const moduleName = file.slice(0, -3);
            const modulePath = `./functions/${moduleName}.js`;
            const { details, execute } = await import(modulePath);

            openAIFunctions.push( {
                "details": details,
                "execute": execute
            });
        }
    }
    state.tools = openAIFunctions
    return openAIFunctions;
}
async function get_and_run_tool(response) {
    let thread_id = focus.thread_id;
    let run_id = focus.run_id;
    // extract function to be called from response
    const toolCalls = response.required_action.submit_tool_outputs.tool_calls;
    let toolOutputs = []
    let functions_available = await getFunctions();
    for (let toolCall of toolCalls) {
        console.log("toolCall: " + JSON.stringify(toolCall));
        let functionName = toolCall.function.name;
        // get function from functions_available
        let functionToExecute = functions_available[`${functionName}`];

        if (functionToExecute.execute) {
            let args = JSON.parse(toolCall.function.arguments);
            let argsArray = Object.keys(args).map((key) => args[key]);
            // insert as first argument pointer to memoryDB
            // check if functionToExecute contains match to  store_in_memory   
            
            let functionResponse = await functionToExecute.execute(...argsArray);
            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(functionResponse)
            });
            let text = JSON.stringify({ message: `function ${functionName} called`, focus: focus });
            await openai.beta.threads.runs.submitToolOutputs(
                thread_id,
                run_id,
                {
                    tool_outputs: toolOutputs
                }
            );
            console.log(`FunctionResponse from ${functionName }:  ${JSON.stringify(functionResponse)}`);
        }
        continue;
    }
}
export {openai, createAssistant,get_and_run_tool};