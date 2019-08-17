build:
	npm run build
	docker build -t dingoeatingfuzz/h19-webhooks .

publish:
	docker tag dingoeatingfuzz/h19-webhooks dingoeatingfuzz/h19-webhooks:$$VERSION
	docker push dingoeatingfuzz/h19-webhooks:$$VERSION
