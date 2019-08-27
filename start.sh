echo "Configuring environment..."
export NOMAD_ADDR=http://hashi.plot.technology:4646
export CONSUL_HOST=http://hashi.plot.technology:8500

echo "Setting consul key/values..."
curl -XPUT --data $1 $CONSUL_HOST/v1/kv/axidraw_address
curl -XPUT --data raised $CONSUL_HOST/v1/kv/axidraw_plot1_state
curl -XPUT --data raised $CONSUL_HOST/v1/kv/axidraw_plot2_state
curl -XPUT --data vagrant $CONSUL_HOST/v1/kv/current_product

echo "Starting nomad jobs..."
nomad run jobs/fabio.hcl
nomad run jobs/webhooks.hcl
nomad run jobs/plotter1.hcl
nomad run jobs/plotter2.hcl
