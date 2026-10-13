import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failures = 0;
let warnings = 0;

function pass(message) {
  console.log(`PASS  ${message}`);
}
function warn(message) {
  warnings += 1;
  console.log(`WARN  ${message}`);
}
function fail(message) {
  failures += 1;
  console.error(`FAIL  ${message}`);
}
function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const packageRaw = read("package.json");
let pkg = {};
try {
  pkg = JSON.parse(packageRaw);
  pass("package.json is valid JSON");
} catch {
  fail("package.json is not valid JSON");
}
for (const script of ["dev", "build", "lint", "typecheck", "qa", "release:preflight", "android:debug:apk", "android:release:aab", "db:setup"]) {
  if (typeof pkg.scripts?.[script] === "string") pass(`package script exists: ${script}`);
  else fail(`Missing package script: ${script}`);
}

const lockExists = fs.existsSync(path.join(root, "bun.lock")) || fs.existsSync(path.join(root, "bun.lockb"));
if (lockExists) pass("Bun lockfile exists"); else fail("Bun lockfile is missing");
if (fs.existsSync(path.join(root, "package-lock.json"))) pass("npm package-lock.json exists");
else warn("package-lock.json not found; npm ci will not be available");

const tsconfig = read("tsconfig.json");
if (/"strict"\s*:\s*true/.test(tsconfig)) pass("TypeScript strict mode is enabled");
else warn("TypeScript strict mode is not enabled");

const capacitor = read("capacitor.config.ts");
const appIdMatch = capacitor.match(/appId\s*:\s*["']([^"']+)["']/);
const appId = appIdMatch?.[1];
if (appId) pass(`Capacitor appId configured: ${appId}`); else fail("Capacitor appId is missing");
const hostedUrlMatch = capacitor.match(/url\s*:\s*["'](https?:\/\/[^"']+)["']/);
if (hostedUrlMatch) warn(`Capacitor loads hosted web app (${hostedUrlMatch[1]}). Deploy the web changes before expecting them in APK.`);
else warn("No remote Capacitor server URL detected; verify that web assets are built and copied to the configured webDir before packaging.");

const manifest = read("android/app/src/main/AndroidManifest.xml");
for (const permission of ["android.permission.INTERNET", "android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION", "android.permission.POST_NOTIFICATIONS"]) {
  if (manifest.includes(permission)) pass(`Android manifest declares ${permission}`);
  else fail(`Android manifest missing ${permission}`);
}
if (appId && (manifest.match(/<manifest[\s\S]*?<\/manifest>/)?.[0] ?? "").includes("android:name=\".MainActivity\"")) {
  pass("Android manifest contains MainActivity launcher");
}
const gradleBuild = read("android/app/build.gradle");
const namespaceMatch = gradleBuild.match(/namespace\s+["']([^"']+)["']/);
const applicationIdMatch = gradleBuild.match(/applicationId\s+["']([^"']+)["']/);
if (appId && namespaceMatch?.[1] === appId && applicationIdMatch?.[1] === appId) pass("Capacitor appId, Android namespace, and applicationId agree");
else fail(`App ID mismatch (Capacitor=${appId ?? "missing"}, namespace=${namespaceMatch?.[1] ?? "missing"}, applicationId=${applicationIdMatch?.[1] ?? "missing"})`);

const wrapperPath = path.join(root, "android/gradlew");
if (fs.existsSync(wrapperPath)) {
  const wrapper = fs.readFileSync(wrapperPath);
  if (wrapper.includes(Buffer.from("\r\n"))) fail("android/gradlew has Windows CRLF line endings; convert it with: perl -pi -e 's/\\r$//' android/gradlew");
  else pass("android/gradlew does not contain CRLF line endings");
  try {
    fs.accessSync(wrapperPath, fs.constants.X_OK);
    pass("android/gradlew has executable permission");
  } catch {
    warn("android/gradlew is not executable in this filesystem; run chmod +x android/gradlew");
  }
}

const envExample = read(".env.example");
for (const key of ["MONGODB_URI", "SESSION_SECRET", "GEMINI_API_KEY", "ELEVENLABS_API_KEY"]) {
  if (new RegExp(`^${key}=`, "m").test(envExample)) pass(`.env.example documents ${key}`);
  else warn(`.env.example does not document ${key}`);
}
for (const sensitive of [".env.local", ".env", ".env.production"]) {
  if (fs.existsSync(path.join(root, sensitive))) warn(`${sensitive} exists locally. Never include it in the ZIP or commit it to Git.`);
}

const schema = read("src/lib/db/schema.ts");
if (/childPhone:\s*\{\s*bsonType:\s*\[\s*["']string["']\s*,\s*["']null["']\s*\]/.test(schema)) pass("MongoDB childPhone validator accepts the nullable type declared in UserRecord");
else fail("MongoDB childPhone validator and nullable TypeScript type may disagree");

console.log(`\nPreflight finished: ${failures} failure(s), ${warnings} warning(s).`);
if (failures > 0) process.exitCode = 1;
