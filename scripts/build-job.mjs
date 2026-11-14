import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { AwsClient } from "aws4fetch";

const jobId = process.env.JOB_ID ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const temp = process.env.RUNNER_TEMP ?? "";
if (!/^[0-9a-f-]{36}$/i.test(jobId) || !supabaseUrl.startsWith("https://") || !serviceKey || !temp) throw new Error("Missing or invalid build configuration");
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

async function db(table, query, options = {}) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { ...options, headers: { ...headers, Prefer: "return=representation", ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`Database request failed (${response.status})`);
  return response.json();
}
async function markFailed() {
  await db("build_jobs", { id: `eq.${jobId}`, status: "in.(queued,running)" }, { method: "PATCH", body: JSON.stringify({ status: "failed", error_message: "Build chưa thành công. Kiểm tra cấu hình Expo, GitHub Actions và R2." }) });
}

async function prepare() {
  const jobs = await db("build_jobs", { id: `eq.${jobId}`, select: "id,project_id,owner_id,platform,status,ui_tree" });
  const job = jobs[0];
  if (!job || job.status !== "queued" || !["android", "ios"].includes(job.platform)) throw new Error("No queued build found");
  const claimed = await db("build_jobs", { id: `eq.${jobId}`, status: "eq.queued" }, { method: "PATCH", body: JSON.stringify({ status: "running", error_message: null }) });
  if (claimed.length !== 1) throw new Error("Build already claimed");
  try {
    const projectId = process.env.EAS_PROJECT_ID ?? "", owner = process.env.EAS_OWNER ?? "", slug = process.env.EAS_PROJECT_SLUG ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[A-Za-z0-9_-]{1,80}$/.test(owner) || !/^[A-Za-z0-9_-]{1,100}$/.test(slug)) throw new Error("Expo project configuration is missing");
    const projects = await db("projects", { id: `eq.${job.project_id}`, owner_id: `eq.${job.owner_id}`, select: "id,name" });
    if (projects.length !== 1) throw new Error("Project not found");
    const support = await import(pathToFileURL(process.env.GENERATOR_BUNDLE ?? "").href);
    const tree = support.parseUiTree(job.ui_tree);
    if (!tree) throw new Error("Invalid page snapshot");
    const files = support.exportToReact(tree, "app", projects[0].id, projects[0].name);
    const app = JSON.parse(files["app.json"]);
    app.expo.owner = owner; app.expo.slug = slug; app.expo.extra = { eas: { projectId } };
    files["app.json"] = JSON.stringify(app, null, 2);
    const destination = resolve(temp, "npt-app");
    await mkdir(destination, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const path = resolve(destination, name);
      if (!path.startsWith(destination + "/")) throw new Error("Invalid export path");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    await writeFile(join(temp, "npt-job.json"), JSON.stringify({ id: job.id, projectId: job.project_id, platform: job.platform }));
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `platform=${job.platform}\nclaimed=true\n`);
  } catch (error) { await markFailed(); throw error; }
}

async function complete() {
  const meta = JSON.parse(await readFile(join(temp, "npt-job.json"), "utf8"));
  const result = JSON.parse(await readFile(join(temp, "eas-result.json"), "utf8"));
  const build = Array.isArray(result) ? result[0] : result;
  const extension = meta.platform === "android" ? "apk" : "ipa";
  const artifactUrl = [build?.artifacts?.applicationArchiveUrl, build?.artifacts?.buildUrl]
    .filter(value => typeof value === "string")
    .map(value => { try { return new URL(value); } catch { return null; } })
    .find(url => url?.protocol === "https:" && url.hostname === "expo.dev" && url.pathname.startsWith("/artifacts/eas/") && url.pathname.toLowerCase().endsWith(`.${extension}`));
  if (!artifactUrl) throw new Error("Unexpected Expo artifact URL");
  const response = await fetch(artifactUrl);
  if (!response.ok) throw new Error("Could not download Expo artifact");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 250_000_000) throw new Error("Artifact is too large");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 250_000_000) throw new Error("Invalid artifact size");
  const account = process.env.R2_ACCOUNT_ID ?? "", bucket = process.env.R2_BUCKET ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !accessKeyId || !secretAccessKey) throw new Error("R2 is not configured");
  const key = `builds/${meta.projectId}/${meta.id}.${extension}`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const uploaded = await aws.fetch(`https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: bytes });
  if (!uploaded.ok) throw new Error("R2 upload failed");
  const updated = await db("build_jobs", { id: `eq.${jobId}`, status: "eq.running" }, { method: "PATCH", body: JSON.stringify({ status: "succeeded", object_key: key, error_message: null }) });
  if (updated.length !== 1) throw new Error("Could not finalize build status");
}

const action = process.argv[2];
if (action === "prepare") await prepare();
else if (action === "complete") await complete();
else if (action === "fail") await markFailed();
else throw new Error("Unknown build operation");
