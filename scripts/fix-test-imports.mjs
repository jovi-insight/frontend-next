import { readFileSync, writeFileSync } from "node:fs";
const path = ".teste-build/perfil.js";
writeFileSync(path, readFileSync(path, "utf8").replaceAll('"./use-local-storage"', '"./use-local-storage.js"'));
