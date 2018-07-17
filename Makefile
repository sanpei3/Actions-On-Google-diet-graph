all:
	zip -r -q weight-AoG.zip index.js node_modules
	aws s3 --profile s3-upload-lambda cp weight-AoG.zip s3://sanpei/Actions-On-Google-diet-graph/
	echo https://s3-ap-northeast-1.amazonaws.com/sanpei/Actions-On-Google-diet-graph/weight-AoG.zip

module-install:
	mkdir node_modules
	npm install request-promise
	npm install request
