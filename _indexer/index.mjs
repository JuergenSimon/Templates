import fs from "fs";
import path from "path";
import YAML from "yaml";
import Ajv from "ajv/dist/2020.js"

import indexSchema from "./schema/index.json" assert { type: "json" };
import optionSchema from "./schema/option.json" assert { type: "json" };

const INDEX_FILENAME = "index.yaml";
const PROFILE_FILENAME = "profile.yaml";

const ajv = new Ajv();
const indexValid = ajv.compile(indexSchema);
const optionValid = ajv.compile(optionSchema);

async function* walk(dir) {
  const files = [];
  for await (const d of await fs.promises.opendir(dir)) {
    if (d.name[0] == "_" || d.name[0] == ".") {
      continue;
    }

    const entry = path.join(dir, d.name);
    if (d.isDirectory()) {
      yield* walk(entry);
      continue;
    }

    files.push(d);
  }

  if (files.find(f => f.name == INDEX_FILENAME))  {
    yield {
      dir,
      files,
    };
  }
}

async function compileEntries(dir, name) {
  const entries = []

  const folder = path.join(dir, name)
  for await (const f of await fs.promises.opendir(folder)) {
    if (!f.isFile() || path.extname(f.name) != ".yaml" || !f.name.endsWith(".option.yaml")) {
      continue;
    }

    const entry = YAML.parse(await fs.promises.readFile(path.join(folder, f.name), 'utf8'));
    if (!optionValid(entry)) {
      console.log(optionValid.errors);
      process.exit(1);
    }

    entries.push({
      name: entry.name,
      title: entry.title,
      desc: entry.desc,
      selector: entry.selector,
      file: path.join(dir, name, f.name)
    })
  }
  
  return entries;
}

const entries = [];
for await (const f of walk('.')) {
  console.log("processing", f.dir)

  const index = YAML.parse(await fs.promises.readFile(path.join(f.dir, INDEX_FILENAME), 'utf8'));
  if (!indexValid(index)) {
    console.log(indexValid.errors);
    process.exit(1);
  }

  if (index.options) {
    const options = [];
    for(const option of index.options) {
      options.push({
        ...option,
        entries: await compileEntries(f.dir, option.name)
      })
    }
    index.options = options;
  }
  
  const category = path.dirname(f.dir);
  const entry = {
    ...index,
    category,
    profile: path.join(f.dir, PROFILE_FILENAME)
  };

  const image = f.files.find(f => f.name.startsWith("image"));
  if (image) {
    entry.image = path.join(f.dir, image.name)
  }

  entries.push(entry);
}

entries.sort((a,b) => {
  return a.name.localeCompare(b.name)
})

await fs.promises.writeFile("index.json", JSON.stringify(entries, undefined, 2));