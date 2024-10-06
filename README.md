# AssistantAgentFuncs002

## This is a basic Agent runner with Function Calling
1 - Ability to call either a GPT model or an Assistant with tools
2 - Call a Function to Store a memory in a scratchpad csv
3 - Call and retrieve data from scratchpad

It picks up a named Agent and creates a Thread (Context Window)
It runs the thread by sending all messages on the Thread to the LLM
A new thread will give a new clean context window
