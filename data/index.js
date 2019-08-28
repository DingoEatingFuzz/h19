const git = require("simple-git");
const fs = require("fs");

const basePath = process.argv[2];

if (!basePath) {
  console.log(`
You must require a base path all HashiCorp repos are cloned into

$ node index.js /path/to/hashicorp/projects
  `);
  process.exit(1);
}

const vagrant = git(`${basePath}/vagrant`);
const packer = git(`${basePath}/packer`);
const terraform = git(`${basePath}/terraform`);
const vault = git(`${basePath}/vault`);
const consul = git(`${basePath}/consul`);
const nomad = git(`${basePath}/nomad`);

getlog(vagrant, "vagrant")
  .then(() => getlog(packer, "packer"))
  .then(() => getlog(terraform, "terraform"))
  .then(() => getlog(vault, "vault"))
  .then(() => getlog(consul, "consul"))
  .then(() => getlog(nomad, "nomad"))
  .then(() => {
    console.log("Finished!");
  })
  .catch((err) => {
    console.log("Ugh, what now?");
    console.log(err);
  });

function getlog(repo, name) {
  console.log(`Fetching log for ${name}...`);
  return new Promise((resolve, reject) => {
    repo.log(
      {
        "--after": "2018/10/24", // HashiConf 2018
        "--reverse": true
      },
      (err, log) => {
        if (err) {
          reject(err);
        } else {
          log.all.forEach(splitRefs);
          console.log(`Success! ${name} get. (${log.total} commits)`);
          write(name, log);
          resolve(log);
        }
      }
    );
  });
}

function write(file, log) {
  fs.writeFileSync(`./exports/${file}.json`, JSON.stringify(log));
}

function splitRefs(commit) {
  commit.refs = commit.refs.split(", ").filter(Boolean);
  commit.tag = commit.refs.find((ref) => ref.startsWith("tag: "));
  if (commit.tag) {
    commit.tag = commit.tag.substr("tag: ".length);
  }
}
