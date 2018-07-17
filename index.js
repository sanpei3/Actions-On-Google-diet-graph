// $Id$

// Copyright (C) 2018 Yoshiro MIHIRA
// For license information, see LICENSE.txt

'use strict';

const rp = require("request-promise");

process.env.TZ = "Asia/Tokyo";

const build_callback_data = (message) => {
    const json = {
        speech: message,
        displayText: message,
    };

    return JSON.stringify(json);
};

const build_callback_data_for_success = (message) => {
    const json = {
        speech: message,
        displayText: message,
        data: {
            google: {
                richResponse: {
                    items: [
                        {
                            simpleResponse: {
                                textToSpeech: message,
                            }
                        },
                       {
                            basicCard: {
                                title: "グラフで確認しませんか?",
                                buttons: [
                                    {
                                        title: "体重グラフへ",
                                        openUrlAction: {
                                            url: "https://diet.dyndns.org/?cmd=user",
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    suggestions: []
                }
            }
        }
    };

    return JSON.stringify(json);
};

function updateDiet(weight, accessToken, callback) {

    var date = Date.now();
    var year = new Date(date).getFullYear().toString();
    var month = (new Date(date).getMonth() +1).toString();
    var day = new Date(date).getDate().toString();
    var hour = new Date(date).getHours().toString();
    var message = null;
    
    var options = {
        method: 'POST',
	uri: "https://diet.dyndns.org/",
	form: {
	    'year' : year,
	    'month' : month,
	    'day' : day,
	    'hour' : hour,
	    'weight' : weight,
	    'comment' : "",
	    'cmd' : "user",
	    'mode' : "input"
	},
        headers: {
            'Authorization': "Bearer " + accessToken, 
        },
    };
    
    rp(options).then((response) => {
	//self.attributes['serverError'] = 0;
	if (response.match(/<p>ログアウトまたはタイムアウトしました。<\/p>/)) {
            const message = "アカウントリンクの有効期限が切れているようです。アカウントリンクを再設定してください";
            callback(null, {
		"statusCode": 200,
		"body": build_callback_data(message)
            });
	} else if (response.match(/登録しました。<br>/)) {
	    message = weight + 'kg で記録しました。';
	    callback(null, {
		"statusCode": 200,
		"body": build_callback_data_for_success(message)
            });
	} else {
            message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください';
            callback(null, {
		"statusCode": 200,
		"body": build_callback_data(message)
            });
	}
    }, (error) => {
	//var serverError = Number(t.attributes['serverError']);
	//var serverError = 0;
	//if (isNaN(serverError) || serverError == 0) {
	    //self.attributes['serverError'] = 1;
    //        message = '記録に失敗しました。再度体重を教えてください。';
	//} else {
	    //self.attributes['serverError'] = 0;
            message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください';
	//}
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
	
    });
}

function convertDotNumberStringToDotNumber(s, maxNumberOfDigit) {
    let dotWeight = Number(s);
    if (!isNaN(dotWeight)) {
	for (var i = 1; i <= maxNumberOfDigit; i++) {
	    var p = Math.pow(10, i);
	    if (dotWeight < p) {
		return dotWeight / p;
	    }
	}
	return -1;
    }
    return 0;
}

exports.handler = (event, context, callback) => {
    var body = "";
    var weight = null;
    var accessToken = null;
    if(event.body == null) {
        console.error('Unable to get body. Error JSON:', event);
        const message = "不正なリクエストです。終了します。";
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    }

    body = JSON.parse(event.body);
    weight = Number(body.result.parameters.weight);
    accessToken = body.originalRequest.data.user.accessToken;
    if (accessToken == null) {
        const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    }

    var options = {
	method: 'GET',
	uri: "https://diet.dyndns.org/?cmd=oa2_isvalid",
	headers: {
	    'Authorization': "Bearer " + accessToken,
	},
    };
    rp(options).then((response) => {
	if (response == '{"isValid":false}') {
            const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
            callback(null, {
		"statusCode": 200,
		"body": build_callback_data(message)
            });
	}
    }, (error) => {
        message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください';
        callback(null, {
            "statusCode": 200,
            "body": build_callback_data(message)
        });
    });

    var resolvedQuery = body.result.resolvedQuery;

    var v1, v2, v3;
    v1 = resolvedQuery.match(/(\d+)\s*ドット\s*(\d+)\s*/);
    v2 = resolvedQuery.match(/(\d+)\s*点\s*(\d+)\s*/);
    v3 = resolvedQuery.match(/(\d+)\s*と\s*(\d+)\s*/);

    if (v1 != undefined) {
        var dotnumber = convertDotNumberStringToDotNumber(v1[2], 5);
        if (dotnumber == -1) {
            weight = undefined;
        } else {
            weight = Number(v1[1]) + dotnumber;
        }
    } else if (v2 != undefined) {
        var dotnumber = convertDotNumberStringToDotNumber(v2[2], 5);
        if (dotnumber == -1) {
            weight = undefined;
        } else {
            weight = Number(v2[1]) + dotnumber;
        }
    } else if (v3 != undefined) {
        var dotnumber = convertDotNumberStringToDotNumber(v3[2], 5);
        if (dotnumber == -1) {
            weight = undefined;
        } else {
            weight = Number(v3[1]) + dotnumber;
        }
    }
    if (weight == undefined) { // || (v1 && v1[1] == weight) || (v2 && v2[1] == weight)) {
        const message = 'すみません、聞き取れませんでした。もう一度、体重を教えてください。';
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    } else {
        if ( 1 <= weight && weight <= 600 ) {
            updateDiet(weight, accessToken, callback);
            return;
        } else {
            const message = '600キログラム以下に対応しています。もう一度、体重を教えてください。';
            callback(null, {
		    "statusCode": 200,
		    "body": build_callback_data(message)
            });
	    }
    }
};
