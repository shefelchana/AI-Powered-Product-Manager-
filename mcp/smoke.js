// Проверка сервера тем же протоколом, которым к нему подключится агент.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["server.js"] }));

const { tools } = await client.listTools();
console.log("инструментов:", tools.length);
for (const tool of tools) {
  const params = Object.keys(tool.inputSchema?.properties ?? {}).join(", ") || "без параметров";
  console.log(`  ${tool.name} (${params})`);
  if (!tool.description) console.log("    ⚠️ БЕЗ ОПИСАНИЯ");
}

const show = (label, result) => {
  const body = result.content.map((c) => c.text).join("\n");
  console.log(`\n--- ${label}${result.isError ? " [ОШИБКА]" : ""} ---\n${body.slice(0, 400)}`);
};

show("list_words (без объяснения)", await client.callTool({
  name: "list_words", arguments: { without_definition: true } }));
show("due_words", await client.callTool({ name: "due_words", arguments: { limit: 3 } }));
show("add_word новое", await client.callTool({
  name: "add_word", arguments: { term: "תקציב" } }));
show("add_word дубль", await client.callTool({
  name: "add_word", arguments: { term: "תקציב" } }));
show("add_example", await client.callTool({
  name: "add_example", arguments: { term: "תקציב", text: "התקציב השנתי אושר" } }));
show("lookup_in_academy", await client.callTool({
  name: "lookup_in_academy", arguments: { term: "תקציב" } }));
show("add_example к несуществующему", await client.callTool({
  name: "add_example", arguments: { term: "ווווו", text: "משהו" } }));

await client.close();
