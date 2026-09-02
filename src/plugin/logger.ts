import type { AgentEvent } from "../shared/protocol.js";
import type { Plugin } from "./types.js";

const loggerPlugin: Plugin = (api) => {
  api.on("agent_start", () => {
    console.log("[plugin] Agent started");
  });

  api.on("turn_start", (event) => {
    if (event.type === "turn_start") {
      console.log(`[plugin] turn ${event.turn} started`);
    }
  });

  api.on("tool_execution_start", (event) => {
    if (event.type === "tool_execution_start") {
      console.log(`[plugin] tool started: ${event.toolName}`);
    }
  });

  api.on("tool_execution_end", (event) => {
    if (event.type === "tool_execution_end") {
      console.log(`[plugin] tool ended: ${event.toolName}`);
    }
  });

  api.on("agent_end", (event) => {
    if (event.type === "agent_end") {
      console.log(`[plugin] Agent ended: ${event.messages.length} messages`);
    }
  });
};

export default loggerPlugin;
