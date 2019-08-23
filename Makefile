axidraw:
	export CONSUL_HOST=hashi.plot.technology
	cd services/axidraw && npm start

ngrok:
	ngrok http 8080
