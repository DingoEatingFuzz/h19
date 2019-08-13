build:
	docker build -t dingoeatingfuzz/art-plotter-webhooks .

publish:
	docker tag dingoeatingfuzz/art-plotter-webhooks gcr.io/hashiconf19/webhooks:$$VERSION
	docker push gcr.io/hashiconf19/webhooks:$$VERSION
