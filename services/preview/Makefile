build:
	parcel build --public-url /preview index.html
	cp ./data/* ./dist
	docker build -t dingoeatingfuzz/h19-preview .

publish:
	docker tag dingoeatingfuzz/h19-preview dingoeatingfuzz/h19-preview:$$VERSION
	docker push dingoeatingfuzz/h19-preview:$$VERSION
