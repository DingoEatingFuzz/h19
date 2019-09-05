build:
	# Copy the art website artifact from source
	cp -r ../../art/dist ./art
	npm run build
	docker build -t dingoeatingfuzz/h19-plot .

publish:
	docker tag dingoeatingfuzz/h19-plot dingoeatingfuzz/h19-plot:$$VERSION
	docker push dingoeatingfuzz/h19-plot:$$VERSION
