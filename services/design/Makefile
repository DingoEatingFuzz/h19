build:
	# Copy the art website artifact from source
	cp -r ../../art/dist ./art
	docker build -t dingoeatingfuzz/h19-design .

publish:
	docker tag dingoeatingfuzz/h19-design dingoeatingfuzz/h19-design:$$VERSION
	docker push dingoeatingfuzz/h19-design:$$VERSION
