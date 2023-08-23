var ws = require("nodejs-websocket")
var port = 8080;

// join 主动加入房间
// leave 主动离开房间
// new-peer 有人加入房间，通知已经在房间的人
// peer-leave 有人离开房间，通知已经在房间的人
// offer 发送offer给对端peer
// answer发送offer给对端peer
// candidate 发送candidate给对端peer
const SIGNAL_TYPE_JOIN = "join";
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  // 告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

/** ----- ZeroRTCMap ----- *///key是uid，value是对应的客户端连接句柄
var ZeroRTCMap = function () {
    this._entrys = new Array();

    this.put = function (key, value) {
        if (key == null || key == undefined) {
            return;
        }
        var index = this._getIndex(key);
        if (index == -1) {
            var entry = new Object();
            entry.key = key;
            entry.value = value;
            this._entrys[this._entrys.length] = entry;
        } else {
            this._entrys[index].value = value;
        }
    };
    this.get = function (key) {//按key返回value，没有key则返回null
        var index = this._getIndex(key);
        return (index != -1) ? this._entrys[index].value : null;
    };
    this.remove = function (key) {//按key移除元素
        var index = this._getIndex(key);
        if (index != -1) {
            this._entrys.splice(index, 1);
        }
    };
    this.clear = function () {//清空
        this._entrys.length = 0;
    };
    this.contains = function (key) {//按key查找map中是否有该key，没有返回false
        var index = this._getIndex(key);
        return (index != -1) ? true : false;
    };
    this.size = function () {//返回map元素个数
        return this._entrys.length;
    };
    this.getEntrys = function () {//返回map本身，可这么getEntrys[key]获取value
        return this._entrys;
    };
    this._getIndex = function (key) {//返回key所在map的位置下标
        if (key == null || key == undefined) {
            return -1;
        }
        var _length = this._entrys.length;
        for (var i = 0; i < _length; i++) {
            var entry = this._entrys[i];
            if (entry == null || entry == undefined) {
                continue;
            }
            if (entry.key === key) {// equal
                return i;
            }
        }
        return -1;
    };
}

var roomTableMap = new ZeroRTCMap();
function Client(uid, conn, roomId) {
    this.uid = uid;     // 用户所属的id
    this.conn = conn;   // uid对应的websocket连接
    this.roomId = roomId;
}

function parseJSON(json) {
    try {
        return JSON.parse(json);
    } catch (e) {
        console.error("Error parsing json: " + json);
    }
    return null;
}


function handleJoin(message, conn) {
    // 判断房间号是否存在
    var roomId = message.roomId;
    var uid = message.uid;
    console.info("uid:" + uid + " try to join roomId: " + roomId);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        roomMap = new ZeroRTCMap();
        roomTableMap.put(roomId, roomMap);      //加入房间table
    }
    // if (roomMap.size() >= 2) {
    //     console.error("roomId:" + roomId + " 已经有两人存在，请使用其他房间");
    //     return null;
    // }

    var client = new Client(uid, conn, roomId);
    roomMap.put(uid, client);
    if (roomMap.size() > 1) {//后进来的客户端
        // 通知房间的另一个人有人加入
        var clients = roomMap.getEntrys();//clients是房间，保存的key是uid，value是conn
        for (var i in clients) {//i是房间的某个元素，遍历操作，如果有多人就会循环多遍
            var remoteUid = clients[i].key;//拿到当前元素的key
            if (remoteUid != uid) {//如果key不是当前加入的key，就给这个元素的conn发送
                //发送通知   通知先进入的客户端后进来的人的uid  在这里发送new peer
                var jsonMsg = {
                    'cmd': SIGNAL_TYPE_NEW_PEER,
                    'remoteUid': uid
                };
                var msg = JSON.stringify(jsonMsg);
                console.info("new peer -> " + msg);
                var remoteClient = roomMap.get(remoteUid);
                remoteClient.conn.sendText(msg);
                // 通知自己 自己是后进来的人 通知后进来的客户端先进入的人的uid  
                jsonMsg = {
                    'cmd': SIGNAL_TYPE_RESP_JOIN,
                    'remoteUid': remoteUid
                };
                msg = JSON.stringify(jsonMsg);
                conn.sendText(msg);
            }
        }

    }
    return client;
}

function handleLeave(message, conn) {
    // 判断房间号是否存在
    var roomId = message.roomId;
    var uid = message.uid;
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("can't find roomId:" + roomId);
        return;
    }
    //如果房间里本身就没有他，就不做处理
    if(roomMap.get(uid)==null)
    {
        return null;
    }
    console.info("uid:" + uid + " try to leave roomId: " + roomId);
    
    roomMap.remove(uid);    // 删除自己

    if (roomMap.size() >= 1) { // 房间还有其他人则通知有人退出
        var clients = roomMap.getEntrys();
        for (var i in clients) {
            // 发送通知
            var jsonMsg = {
                'cmd': SIGNAL_TYPE_PEER_LveEAVE,
                'remoteUid': uid
            };
            var msg = JSON.stringify(jsonMsg);
            console.info("peer leave -> " + msg);
            
            var remoteUid = clients[i].key;
            console.info("peer i -> " + i + ', remoteUid ->' + remoteUid);
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient)
            {
                console.info("to peer:" + remoteClient.uid + ", conn:" + remoteClient.conn);
                remoteClient.conn.sendText(msg);
            }

        }
        // var client = roomMap.get(remoteUid);
        // if(client != null) {
        //     var jsonMsg = {
        //         'cmd': SIGNAL_TYPE_PEER_LEAVE,
        //         'remoteUid': uid
        //     };
        //     console.info("to peer:" + client.uid + ", conn:" + client.conn);
        //     var msg = JSON.stringify(jsonMsg);
        //     client.conn.sendText(msg);
        // } else {
        //     console.error("can't find remoteUid:" + remoteUid);
        // }
    }

}

//强制退出的处理
function handleForceLeave(client) {
    // 判断房间号是否存在
    var roomId = client.roomId;
    var uid = client.uid;
    var conn = client.conn;
    console.info("uid:" + uid + " force to leave roomId: " + roomId);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        return;
    }

    if(roomMap.get(uid) != null) {
        roomMap.remove(uid);    // 删除自己
        // 通知房间的另一个人对方离开了
        var clients = roomMap.getEntrys();
        for (var i in clients) {
            var remoteUid = clients[i].key;
            if (remoteUid != uid) {
                console.info("peer leave -> " + uid + " notify to " + remoteUid);
                //发送peer leave 给被动退出的客户端
                var remoteClient = roomMap.get(remoteUid);
                // 通知自己
                jsonMsg = {
                    'cmd': SIGNAL_TYPE_PEER_LEAVE,
                    'remoteUid': uid
                };
                msg = JSON.stringify(jsonMsg);
                remoteClient.conn.sendText(msg);
            }
        }
    } else {
        console.log("uid:" + uid + " have leave");
    }
}

function handleOffer(message, conn) {
    // 判断房间号是否存在
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;
    console.info("roomID: " + roomId + ", "+ "uid:" + uid + " try to transfer offer to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("can't find roomId:" + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("in roomId:" + roomId + " can't find uid:" + uid);
        return;
    }

    remoteClient = roomMap.get(remoteUid);
    if (remoteClient != null) { // 不为空就发送给远端客户端
        var msg = JSON.stringify(message);
        // console.info("offer -> " + msg);
        remoteClient.conn.sendText(msg);
    } else {
        var msg = "can't find the remoteUid: " + remoteUid;
        // console.info("offer -> " + msg);
        remoteClient.conn.sendText(msg);
    }
}

function handleAnswer(message, conn) {
    // 判断房间号是否存在
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;
    console.info("roomID: " + roomId + ", "+ "uid:" + uid + " try to transfer answer to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("can't find roomId:" + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("in roomId:" + roomId + " can't find uid:" + uid);
        return;
    }

    remoteClient = roomMap.get(remoteUid);
    if (remoteClient != null) { // 房间还有其他人则通知有人退出
        var msg = JSON.stringify(message);
        // console.info("answer -> " + msg);
        remoteClient.conn.sendText(msg);
    } else {
        var msg = "can't find the remoteUid: " + remoteUid;
        // console.info("answer -> " + msg);
        remoteClient.conn.sendText(msg);
    }
}

function handleCandidate(message, conn) {
    // 判断房间号是否存在
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;
    console.info("roomID: " + roomId + ", "+ "uid:" + uid + " try to transfer candidate to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("can't find roomId:" + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("in roomId:" + roomId + " can't find uid:" + uid);
        return;
    }

    remoteClient = roomMap.get(remoteUid);
    if (remoteClient != null) { 
        var msg = JSON.stringify(message);
        // console.info("candidate -> " + msg);
        remoteClient.conn.sendText(msg);
    } else {
        var msg = "can't find the remoteUid: " + remoteUid;
        // console.info("candidate -> " + msg);
        remoteClient.conn.sendText(msg);
    }
}

// 创建一个连接，这是websocket模块的server
var server = ws.createServer(function (conn) {
    console.log("创建一个新的连接--------");
    conn.client = null;

    //收到消息
    conn.on("text", function (str) {
        // console.info("recv msg:" + str);
        var message = parseJSON(str);//序列化
        if(message == null) {
            console.error("parse msg:" + str + " failed");
            return;
        }
        switch (message.cmd) {
            case SIGNAL_TYPE_JOIN:
                conn.client = handleJoin(message, conn);
                break;
            case SIGNAL_TYPE_LEAVE:
                handleLeave(message, conn);
                break;
            case SIGNAL_TYPE_OFFER:
                handleOffer(message, conn);//收到offer直接转发
                break;
            case SIGNAL_TYPE_ANSWER:
                handleAnswer(message, conn);//收到answer直接转发
                break;
            case SIGNAL_TYPE_CANDIDATE:
                handleCandidate(message, conn);//收到candidate直接转发
                break;
            default:
                console.error("can't handle msg: " + str);
                break;
        }

        // 收到数据，先解析数据，拿到cm和要转发的uid，再将数据进行发送即可。
    });

    //监听关闭连接操作  客户端异常退出的处理
    conn.on("close", function (code, reason) {
        console.log("关闭连接");
        if(conn.client != null)//这里的conn应该就是异常断开的连接
            handleForceLeave(conn.client);
    });

    //错误处理
    conn.on("error", function (err) {
        console.log("监听到错误");
        console.log(err);
    });
}).listen(port);


