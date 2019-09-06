.EXPORT_ALL_VARIABLES:

CONSUL_HOST=hashi.plot.technology

axidraw:
	cd services/axidraw && npm start

ngrok:
	ngrok http 8080
