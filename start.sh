echo "Configuring environment..."
export NOMAD_ADDR=hashi.plot.technology:4646
export CONSUL_HOST=hashi.plot.technology:8500

echo "Setting consul key/values..."
consul kv put axidraw_address $1
consul kv put current_product vagrant

echo "Starting nomad jobs..."
nomad run jobs/fabio.hcl
nomad run jobs/webhooks.hcl
nomad run jobs/plotter1.hcl
