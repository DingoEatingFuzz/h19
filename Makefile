.EXPORT_ALL_VARIABLES:

CONSUL_HOST=hashi.plot.technology

axidraw:
	cd services/axidraw && npm start

ngrok:
	ngrok http 8080

reset:
	curl -XPOST http://localhost:8080/reset/$$PLOTTER
