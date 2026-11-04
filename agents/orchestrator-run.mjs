import { stages, LABEL_PREFIX, transition, stageFromLabels, handoverComment } from "./orchestrator.mjs";
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const issue = Number(process.env.ISSUE_NUMBER);
const event = process.env.HANDOVER_EVENT;
if (!token || !repo || !Number.isSafeInteger(issue) || issue < 1 || !event) throw new Error("Missing or invalid workflow inputs");
const [owner, name] = repo.split("/");
if (!owner || !name) throw new Error("Invalid repository");
const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path} returned ${response.status}: ${(await response.text()).slice(0,300)}`);
  return response.status === 204 ? null : response.json();
}
const item = await api(`/issues/${issue}`);
if (item.pull_request) throw new Error("Use an issue, not a pull request");
if (item.state !== "open") throw new Error("Issue must be open");
const current = stageFromLabels(item.labels);
const next = transition(current, event);
const label = LABEL_PREFIX + next;
const old = current && LABEL_PREFIX + current;
await api("/labels", "POST", { name: label, color: "D4C5F9", description: "Today Cook What orchestrator stage" }).catch(async err => {
  if (!String(err).includes("422")) throw err; // already exists
});
await api(`/issues/${issue}/labels`, "POST", { labels: [label] });
if (old) await api(`/issues/${issue}/labels/${encodeURIComponent(old)}`, "DELETE");
await api(`/issues/${issue}/comments`, "POST", { body: handoverComment(current, next, event) });
console.log(`Issue #${issue}: ${current ?? "none"} -> ${next}. Role: ${stages[next].owner}`);
