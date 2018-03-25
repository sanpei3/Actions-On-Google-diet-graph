all:
	zip -r -q weight-AoG.zip index.js node_modules

module-install:
	mkdir node_modules
	npm install request-promise
	npm install request
