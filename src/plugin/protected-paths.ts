import type { Plugin } from "./types.js";

const protectedPathsPlugin: Plugin = (api) => {
  api.onToolCall((call) => {
    if (call.name !== "write_note") {
      return { action: "allow" };
    }

    const fileName = call.arguments.fileName;

    return {
         action: "confirm",
         prompt: `是否允许写入笔记文件：${String(fileName)}？`,
       };
  });
};

export default protectedPathsPlugin;
