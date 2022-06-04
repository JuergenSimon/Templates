import fs from "fs";
import path from "path";
import YAML from "yaml";

const INDEX_FILENAME = "index.yaml";

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

const entries = [];
for await (const f of walk('.')) {
  const index = YAML.parse(await fs.promises.readFile(path.join(f.dir, INDEX_FILENAME), 'utf8'));
  
  const category = path.dirname(f.dir);
  const entry = {
    ...index,
    category,
    profile: path.join(f.dir, "profile.yaml")
  };

  const image = f.files.find(f => f.name.startsWith("image"));
  if (image) {
    entry.image = path.join(f.dir, image.name)
  }

  entries.push(entry);
}

await fs.promises.writeFile("index.json", JSON.stringify(entries, undefined, 2));