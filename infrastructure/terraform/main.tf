provider "google" {
  credentials = "${file("account.json")}"
  project = "hashiconf19"
  region = "us-west1"
  zone = "us-west1-b"
}

module "hashistack" {
  source = "./hashistack"

  name = "art-plotter"
  zone = "us-west1-b"
  server_machine_type = "n1-standard-1"
  client_machine_type = "g1-small"
  server_count = 3
  client_count = 2
  nomad_binary = "https://releases.hashicorp.com/nomad/0.9.0/nomad_0.9.4_linux_amd64.zip"
  root_block_device_size = 16
  client_block_size = 50
  whitelist_ip = "0.0.0.0/0"
  image = "packer-1564731209"
}

output "IP_Addresses" {
  value = <<CONFIGURATION
Client public IPs: ${join(", ", module.hashistack.client_public_ips)}
Server public IPs: ${join(", ", module.hashistack.server_public_ips)}

To connect, add your private key and SSH into any client or server with
`ssh ubuntu@PUBLIC_IP`. You can test the integrity of the cluster by running:

  $ consul members
  $ nomad server members
  $ nomad node status

If you see an error message like the following when running any of the above
commands, it usually indicates that the configuration script has not finished
executing:

"Error querying servers: Get http://127.0.0.1:4646/v1/agent/members: dial tcp
127.0.0.1:4646: getsockopt: connection refused"

Simply wait a few seconds and rerun the command if this occurs.

The Nomad UI can be accessed at http://${module.hashistack.server_public_ips[0]}:4646/ui.
The Consul UI can be accessed at http://${module.hashistack.server_public_ips[0]}:8500/ui.

Set the following for access from the Nomad CLI:

  export NOMAD_ADDR=http://${module.hashistack.server_public_ips[0]}:4646
CONFIGURATION
}
