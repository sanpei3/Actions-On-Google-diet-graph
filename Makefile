MODULE=weight-AoG
all:
	node index.js
	zip -r -q ${MODULE} index.js  node_modules
	aws lambda update-function-code --function-name "weight-graph-actions-on-google-test" --zip-file fileb://${MODULE}.zip

module-install:
	mkdir node_modules
	npm install request-promise-native
	npm install request
	npm install actions-on-google
