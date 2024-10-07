import fs from 'fs';
import { Server, get } from 'http';
import path from 'path';
import OpenAI from 'openai';
import {state, get_assistant, create_thread, run_agent, run_chatgpt, get_all_messages} from './server.js';
import { response, text } from 'express';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
async function createAssistant(name, instructions) {
    try {
        const functions = await getFunctions();

        let local_tools = [];
    // lets just add all the tools to the assistant
        
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
        state.tools = local_tools;
        console.log(`Assistant created state: ${JSON.stringify(state)}`);
    
        return assistant;
    } catch (error) {
        console.log(error);
        return error;
    }
}   
async function getFunctions() {
   
    const files = fs.readdirSync(path.resolve(process.cwd(), "./functions"));
    const openAIFunctions = {};

    for (const file of files) {
        if (file.endsWith(".js")) {
            const moduleName = file.slice(0, -3);
            const modulePath = `./functions/${moduleName}.js`;
            const { details, execute } = await import(modulePath);

            openAIFunctions[moduleName] = {
                "details": details,
                "execute": execute
            };
        }
    }
    return openAIFunctions;
}

async function get_response(thread_id){
  messages = await client.beta.threads.messages.list(thread_id=thread_id)
  message_content = messages.data[0].content[0].text

  // Remove annotations
  annotations = message_content.annotations
  for (annotation in annotations){
    message_content.value = message_content.value.replace(annotation.text, '')
  }
  response_message = message_content.value
  return response_message
}
async function get_run_status(thread_id, run_id) {
    try {
        let runStatus = await openai.beta.threads.runs.retrieve(thread_id, run_id);
        while (runStatus.status != 'completed') {
            if (runStatus.status == 'requires_action'){
                console.log("Requires Action - NEED TO CALL FUNCTION")
                let response = await openai.beta.threads.runs.retrieve(thread_id, state.run_id)
                let response_message = await get_and_run_tool(response);
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 1 second
            runStatus = await openai.beta.threads.runs.retrieve(thread_id, run_id);
        }
        return;
    }catch (error) {
        console.log(error);
        return error;
    }
}
async function addLastMessagetoArray(message, messages) {
    messages.push(message.data[0].content[0].text.value)
    console.log("PRINTING MESSAGES: ");
    console.log(message.data[0].content[0].text.value)
}

async function get_and_run_tool(response) {
    let thread_id = state.thread_id;
    let run_id = state.run_id;
    console.log(`in get_and_run_tool: ${JSON.stringify(state)}`);
    // extract function to be called from response
    const toolCalls = response.required_action.submit_tool_outputs.tool_calls;
    let toolOutputs = []
    let functions_available = await getFunctions();
    let text = "";
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
            console.log(`FunctionResponse from ${functionName }:  ${JSON.stringify(functionResponse)}`);
            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(functionResponse)
            });
            text = JSON.stringify({ message: `function ${functionName} called`, state: state });
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
    return text;
}
export {openai, createAssistant, getFunctions, get_response, get_and_run_tool,get_run_status,addLastMessagetoArray};