all:
	node index.js
	zip -r -q weight-AoG.zip index.js node_modules
	aws lambda update-function-code --function-name "weight-graph-actions-on-google-test" --zip-file fileb://weight-AoG.zip

module-install:
	mkdir node_modules
	npm install request-promise-native
	npm install request
	npm install actions-on-google
