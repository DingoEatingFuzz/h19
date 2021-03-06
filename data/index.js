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
        "--stat": 1000,
        "--reverse": true,
        format: {
          hash: "%H",
          date: "%ai",
          message: "%s",
          refs: "%D",
          body: "%b",
          author_name: "%aN",
          author_email: "%ae",
          parents: "%P"
        }
      },
      (err, log) => {
        if (err) {
          reject(err);
        } else {
          log.all.forEach(structure);
          // Create a hashmap to traverse parents to avoid linear scans of the all
          // commits array.
          log.hashmap = log.all.reduce((hash, commit, idx) => {
            hash[commit.hash] = idx;
            return hash;
          }, {});
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

function structure(commit) {
  // Split refs into an array
  commit.refs = commit.refs.split(", ").filter(Boolean);
  commit.tag = commit.refs.find((ref) => ref.startsWith("tag: "));

  // Treat tag as first class
  if (commit.tag) {
    commit.tag = commit.tag.substr("tag: ".length);
  }

  // Split parents as an array
  commit.parents = commit.parents.split(" ").filter(Boolean);
}
