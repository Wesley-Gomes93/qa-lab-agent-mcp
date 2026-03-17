import path from "node:path";
import fs from "node:fs";

const PROJECT_ROOT = process.cwd();

export function detectProjectStructure() {
  const structure = {
    hasTests: false,
    testFrameworks: [],
    testDirs: [],
    hasBackend: false,
    backendDir: null,
    hasFrontend: false,
    frontendDir: null,
    hasMobile: false,
    packageJson: null,
    pythonRequirements: null,
  };

  const pkgPath = path.join(PROJECT_ROOT, "package.json");
  if (fs.existsSync(pkgPath)) {
    structure.packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = {
      ...structure.packageJson.dependencies,
      ...structure.packageJson.devDependencies,
    };

    if (deps.cypress) {
      structure.testFrameworks.push("cypress");
      structure.hasTests = true;
    }
    if (deps["@playwright/test"] || deps.playwright) {
      structure.testFrameworks.push("playwright");
      structure.hasTests = true;
    }
    if (deps.webdriverio || deps["@wdio/cli"]) {
      structure.testFrameworks.push("webdriverio");
      structure.hasTests = true;
    }

    if (deps.jest) {
      structure.testFrameworks.push("jest");
      structure.hasTests = true;
    }
    if (deps.vitest) {
      structure.testFrameworks.push("vitest");
      structure.hasTests = true;
    }
    if (deps.mocha) {
      structure.testFrameworks.push("mocha");
      structure.hasTests = true;
    }
    if (deps.jasmine) {
      structure.testFrameworks.push("jasmine");
      structure.hasTests = true;
    }

    if (deps.appium || deps["appium-webdriverio"]) {
      structure.testFrameworks.push("appium");
      structure.hasTests = true;
      structure.hasMobile = true;
    }
    if (deps.detox) {
      structure.testFrameworks.push("detox");
      structure.hasTests = true;
      structure.hasMobile = true;
    }

    if (deps.supertest) {
      structure.testFrameworks.push("supertest");
      structure.hasTests = true;
    }
    if (deps["@pactum/pactum"] || deps.pactum) {
      structure.testFrameworks.push("pactum");
      structure.hasTests = true;
    }

    if (deps.testcafe || deps["testcafe"]) {
      structure.testFrameworks.push("testcafe");
      structure.hasTests = true;
    }
    if (deps.nightwatch || deps["nightwatch"]) {
      structure.testFrameworks.push("nightwatch");
      structure.hasTests = true;
    }
    if (deps.puppeteer) {
      structure.testFrameworks.push("puppeteer");
      structure.hasTests = true;
    }
    if (deps.codeceptjs || deps["codeceptjs"]) {
      structure.testFrameworks.push("codeceptjs");
      structure.hasTests = true;
    }

    if (deps.express || deps.fastify || deps["@nestjs/core"] || deps.koa) {
      structure.hasBackend = true;
    }
    
    if (deps.next || deps.react || deps.vue || deps.svelte || deps.angular) {
      structure.hasFrontend = true;
    }
  }

  const requirementsPath = path.join(PROJECT_ROOT, "requirements.txt");
  if (fs.existsSync(requirementsPath)) {
    const requirements = fs.readFileSync(requirementsPath, "utf8");
    structure.pythonRequirements = requirements;

    if (/robotframework/i.test(requirements)) {
      structure.testFrameworks.push("robot");
      structure.hasTests = true;
    }
    if (/pytest/i.test(requirements)) {
      structure.testFrameworks.push("pytest");
      structure.hasTests = true;
    }
    if (/behave/i.test(requirements)) {
      structure.testFrameworks.push("behave");
      structure.hasTests = true;
    }
    if (/requests/i.test(requirements)) {
      structure.hasBackend = true;
    }
  }

  const commonTestDirs = [
    "tests", "test", "e2e", "cypress", "playwright", "__tests__",
    "specs", "spec", "integration", "unit", "functional", "robot",
    "features", "scenarios", "mobile", "api",
    "playwright-js", "puppeteer-js", "testcafe-js", "wdio-webdriver-io",
    "nightwatch-js", "codeceptjs", "robot-framework", "selenium-python"
  ];
  for (const dir of commonTestDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      structure.testDirs.push(dir);
    }
  }

  const skipDirs = ["node_modules", ".git", "dist", "build", ".next", ".venv"];
  try {
    const rootEntries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
    for (const e of rootEntries) {
      if (!e.isDirectory() || skipDirs.includes(e.name)) continue;
      const subPath = path.join(PROJECT_ROOT, e.name);
      if (structure.testDirs.includes(e.name)) continue;
      const hasPkg = fs.existsSync(path.join(subPath, "package.json"));
      const hasTests = fs.existsSync(path.join(subPath, "tests")) ||
        fs.existsSync(path.join(subPath, "test")) ||
        fs.existsSync(path.join(subPath, "e2e")) ||
        fs.existsSync(path.join(subPath, "__tests__")) ||
        fs.existsSync(path.join(subPath, "specs"));
      if (hasPkg || hasTests) {
        structure.testDirs.push(e.name);
      }
    }
  } catch {}

  for (const dir of structure.testDirs) {
    const subPkg = path.join(PROJECT_ROOT, dir, "package.json");
    if (!fs.existsSync(subPkg)) continue;
    try {
      const sub = JSON.parse(fs.readFileSync(subPkg, "utf8"));
      const subDeps = { ...(sub.dependencies || {}), ...(sub.devDependencies || {}) };
      const toAdd = [];
      if (subDeps.cypress && !structure.testFrameworks.includes("cypress")) toAdd.push("cypress");
      if ((subDeps["@playwright/test"] || subDeps.playwright) && !structure.testFrameworks.includes("playwright")) toAdd.push("playwright");
      if ((subDeps.webdriverio || subDeps["@wdio/cli"]) && !structure.testFrameworks.includes("webdriverio")) toAdd.push("webdriverio");
      if (subDeps.testcafe && !structure.testFrameworks.includes("testcafe")) toAdd.push("testcafe");
      if (subDeps.nightwatch && !structure.testFrameworks.includes("nightwatch")) toAdd.push("nightwatch");
      if (subDeps.puppeteer && !structure.testFrameworks.includes("puppeteer")) toAdd.push("puppeteer");
      if (subDeps.codeceptjs && !structure.testFrameworks.includes("codeceptjs")) toAdd.push("codeceptjs");
      if (subDeps.jest && !structure.testFrameworks.includes("jest")) toAdd.push("jest");
      toAdd.forEach((fw) => { structure.testFrameworks.push(fw); structure.hasTests = true; });
    } catch {}
  }

  for (const dir of structure.testDirs) {
    const reqPath = path.join(PROJECT_ROOT, dir, "requirements.txt");
    if (!fs.existsSync(reqPath)) continue;
    try {
      const req = fs.readFileSync(reqPath, "utf8");
      if (/robotframework/i.test(req) && !structure.testFrameworks.includes("robot")) {
        structure.testFrameworks.push("robot");
        structure.hasTests = true;
      }
      if (/pytest|selenium/i.test(req) && !structure.testFrameworks.includes("pytest")) {
        structure.testFrameworks.push("pytest");
        structure.hasTests = true;
      }
    } catch {}
  }

  const commonBackendDirs = ["backend", "server", "api", "src"];
  for (const dir of commonBackendDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && !structure.backendDir) {
      const hasServerFile = fs.existsSync(path.join(fullPath, "server.js")) ||
        fs.existsSync(path.join(fullPath, "index.js")) ||
        fs.existsSync(path.join(fullPath, "app.js"));
      if (hasServerFile) {
        structure.backendDir = dir;
      }
    }
  }

  const commonFrontendDirs = ["frontend", "client", "web", "app", "src"];
  for (const dir of commonFrontendDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath) && !structure.frontendDir) {
      const hasAppFile = fs.existsSync(path.join(fullPath, "App.js")) ||
        fs.existsSync(path.join(fullPath, "App.tsx")) ||
        fs.existsSync(path.join(fullPath, "index.html"));
      if (hasAppFile) {
        structure.frontendDir = dir;
      }
    }
  }

  return structure;
}

const UNIVERSAL_TEST_PATTERNS = [
  /\.(cy|spec|test)\.(js|ts|jsx|tsx)$/i,
  /_test\.(js|ts)$/i,
  /\.robot$/i,
  /\.feature$/i,
  /^(test_.*|.*_test)\.py$/i,
  /\.steps?\.(js|ts|py)$/i,
  /\.e2e\.(js|ts)$/i,
  /\.it\.(js|ts)$/i,
];

export function isTestFile(name) {
  return UNIVERSAL_TEST_PATTERNS.some((re) => re.test(name));
}

export function collectTestFiles(structure, options = {}) {
  const { pattern, framework, maxContentFiles = 0 } = options;
  const results = [];

  for (const dir of structure.testDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    const walk = (p, base = "") => {
      if (!fs.existsSync(p)) return;
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === ".git" || e.name === ".venv") continue;
          walk(path.join(p, e.name), rel);
        } else if (e.isFile() && isTestFile(e.name)) {
          const filePath = `${dir}/${rel}`;
          if (pattern && !filePath.toLowerCase().includes(pattern.toLowerCase())) continue;
          const inferredFw = inferFrameworkFromFile(e.name, structure, filePath);
          if (framework && framework !== "all" && inferredFw !== framework && !matchesFramework(inferredFw, framework)) continue;
          const entry = { path: filePath, inferredFramework: inferredFw };
          if (maxContentFiles > 0 && results.length < maxContentFiles) {
            try {
              entry.content = fs.readFileSync(path.join(PROJECT_ROOT, filePath), "utf8");
            } catch {}
          }
          results.push(entry);
        }
      }
    };
    walk(fullPath);
  }
  return results;
}

export function inferFrameworkFromFile(name, structure = {}, filePath = "") {
  const pathLower = (filePath || "").toLowerCase().replace(/\\/g, "/");
  if (/[\/]cypress[\/\-]/.test(pathLower)) return "cypress";
  if (/[\/]playwright[\/\-]/.test(pathLower)) return "playwright";
  if (/[\/]wdio[\/\-]|[\/]webdriver[\/\-]/.test(pathLower)) return "webdriverio";
  if (/[\/]appium[\/\-]/.test(pathLower)) return "appium";
  if (/[\/]selenium-python[\/]|[\/]pytest[\/\-]/.test(pathLower)) return "pytest";
  if (/[\/]robot[\/\-]/.test(pathLower)) return "robot";
  if (/[\/]codecept[\/\-]/.test(pathLower)) return "codeceptjs";
  if (/[\/]nightwatch[\/\-]/.test(pathLower)) return "nightwatch";
  if (/[\/]testcafe[\/\-]/.test(pathLower)) return "testcafe";
  if (/[\/]puppeteer[\/\-]/.test(pathLower)) return "puppeteer";
  if (/[\/]behave[\/\-]|[\/]features[\/]/.test(pathLower)) return "behave";
  if (/\.cy\.(js|ts|jsx|tsx)/i.test(name)) return "cypress";
  if (/_test\.(js|ts)$/i.test(name)) return "codeceptjs";
  if (/\.spec\.(js|ts|jsx|tsx)/i.test(name)) {
    if (structure?.testFrameworks?.includes("webdriverio")) return "webdriverio";
    if (structure?.testFrameworks?.includes("appium")) return "appium";
    return "playwright";
  }
  if (/\.test\.(js|ts|jsx|tsx)/i.test(name)) return structure?.testFrameworks?.includes("vitest") ? "vitest" : "jest";
  if (/\.robot$/i.test(name)) return "robot";
  if (/\.feature$/i.test(name)) return "behave";
  if (/\.(py|steps?\.py)$/i.test(name) || /^(test_.*|.*_test)\.py$/i.test(name)) return "pytest";
  if (/\.e2e\.(js|ts)/i.test(name)) return "playwright";
  return "unknown";
}

export function matchesFramework(inferred, requested) {
  const aliases = { spec: ["playwright", "webdriverio", "appium"] };
  if (inferred === requested) return true;
  return aliases[inferred]?.includes(requested);
}

export function getFrameworkCwd(structure, preferredDirs) {
  for (const dir of preferredDirs) {
    if (structure.testDirs.includes(dir)) {
      return path.join(PROJECT_ROOT, dir);
    }
  }
  const fallback = structure.testDirs[0];
  return fallback ? path.join(PROJECT_ROOT, fallback) : PROJECT_ROOT;
}

export function analyzeCodeRisks() {
  const structure = detectProjectStructure();
  const risks = [];

  const srcDirs = ["src", "app", "lib", "components", "pages", "api", "services", "controllers"];
  const foundDirs = srcDirs.filter((dir) => fs.existsSync(path.join(PROJECT_ROOT, dir)));

  foundDirs.forEach((dir) => {
    const fullPath = path.join(PROJECT_ROOT, dir);
    const files = fs.readdirSync(fullPath, { recursive: true }).filter((f) => /\.(js|ts|jsx|tsx|py)$/.test(f));
    
    const hasTests = structure.testDirs.some((testDir) => {
      const testPath = path.join(PROJECT_ROOT, testDir);
      if (!fs.existsSync(testPath)) return false;
      const testFiles = fs.readdirSync(testPath, { recursive: true });
      return testFiles.some((tf) => tf.includes(dir) || tf.toLowerCase().includes(dir.toLowerCase()));
    });

    if (!hasTests && files.length > 0) {
      risks.push({
        area: dir,
        files: files.length,
        risk: files.length > 20 ? "high" : files.length > 10 ? "medium" : "low",
        reason: "Sem testes detectados para esta área",
      });
    }
  });

  return risks.sort((a, b) => {
    const riskOrder = { high: 3, medium: 2, low: 1 };
    return riskOrder[b.risk] - riskOrder[a.risk];
  });
}
