'use strict';

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
// const SIGNAL_TYPE_FORCE_LEAVE = "force-leave";

var localUserId = Math.random().toString(36).substr(2); // store local userId
var remoteUserId = -1;
var answer_i = 0;
var remoteUserId1 = -1;
var localStream = null; // local video stream object
var remoteStream = null;
var pc = null; // webrtc RTCPeerConnection
var show_audio = true;
var show_video = true;
var p2ping = false;

var roomId = '100';
var userName = '';
// 拿到视频控件
var localVideo = document.querySelector('#localVideo'); // 本地头像
var remoteVideo1 = document.querySelector('#remoteVideo1');// 远端头像
var remoteVideo2 = document.querySelector('#remoteVideo2');// 远端头像
var zeroRTCEngine;
//
var MyMap = function () {//key为用户id，value为UserMsg
    this._entrys = new Array();//一个数组，每个数组元素包含一个Object对象，Object.key=key,Object.value=value,

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
        // if (index != -1) {
        //     this._entrys.splice(index, 1);
        // }
        /**************上面是通用map写法******************* */
        /**************下面是三人通话map写法******************* */
        if (index != -1) {
            if(index!=this._entrys.length-1){//代表不是删除的数组最后一个元素
                for(var i=0;index+1+i<this._entrys.length;i++){
                    this._entrys[index+i]=this._entrys[index+1+i];
                    this._entrys[index+i].value.videoShow--;
                }
            }
            this._entrys.splice(this._entrys.length-1, 1);
            
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
var userMap = new MyMap();
function UserMsg(pc,videoshow) {//这个作为map的value
    // this.talkType = talkType;   
    // this.fromName = fromName;   
    this.pc=pc;
    this.videoShow=videoshow;
}

var ZeroRTCEngine = function (wsUrl) {//相当于构造函数，构造ZeroRTCEngine类
    this.init(wsUrl);
    zeroRTCEngine = this;
    return this;
}

ZeroRTCEngine.prototype.init = function (wsUrl) {
    // 设置websocket  url
    this.wsUrl = wsUrl;
    /** websocket对象 */
    this.signaling = null;
}
//创建Websocket，new一个Websocket对象，注册连接、收到数据、出错、关闭的处理函数
ZeroRTCEngine.prototype.createWebsocket = function () {
    var zeroRTCEngine = this;
    zeroRTCEngine.signaling = new WebSocket(this.wsUrl);
    zeroRTCEngine.signaling.onopen = function () {//设置onopen的回调
        zeroRTCEngine.onOpen();
    };
    zeroRTCEngine.signaling.onmessage = function (ev) {
        zeroRTCEngine.onMessage(ev);
    };
    zeroRTCEngine.signaling.onerror = function (ev) {
        console.error("连接websocket失败请重试, msg:" + ev);
        zeroRTCEngine.onError(ev);
    };
    zeroRTCEngine.signaling.onclose = function (ev) {
        zeroRTCEngine.onClose(ev);
    };
};

ZeroRTCEngine.prototype.sendJsonMessage = function (parameters) {
    var message = JSON.stringify(parameters);
    this.signaling.send(message);
};
ZeroRTCEngine.prototype.sendMessage = function (message) {
    this.signaling.send(message);
};
/**
 * onOpen
 * 连接上WebScoekt的处理
 */
ZeroRTCEngine.prototype.onOpen = function () {
    console.info('websocket open');
}

function parseJSON(json) {
    try {
        return JSON.parse(json);
    } catch (e) {
        console.error("Error parsing json: " + json);
    }
    return null;
}
/** onMessage
 * WebSocket收到数据时的处理
 * @param {*} event 
 * @returns 
 */
ZeroRTCEngine.prototype.onMessage = function (event) {
    
    var message = parseJSON(event.data);
    console.info("onMessage: " + message.cmd);
    if(message == null) {
        console.error("parse msg:" + message + " failed");
        return;
    }
    switch (message.cmd) {
        case SIGNAL_TYPE_RESP_JOIN://房间有其他人加入时，服务器会发resp_join
            handleResponseJoin(message);//第三者
            return;
        case SIGNAL_TYPE_NEW_PEER:  //收到new peer信令的处理 要获取本地SDP，设置到本地，打包成offer发送给远端
            handleRemoteNewPeer(message);
            return;
        case SIGNAL_TYPE_PEER_LEAVE:  // 处理远端离开
            handleRemotePeerLeave(message);
            return;
        case SIGNAL_TYPE_OFFER:
            handleRemoteOffer(message);//收到offer的处理 要设置远端SDP，设置自己的SDP，然后打包成answer回给远端
            return;                     //第三者
        case SIGNAL_TYPE_ANSWER:
            handleRemoteAnswer(message);//收到answer的处理 要设置远端的SDP
            return;
        case SIGNAL_TYPE_CANDIDATE:
            handleRemoteCandidate(message);//收到Candidate的处理 要addIceCandidate
            return;
        // case SIGNAL_TYPE_FORCE_LEAVE:
        //     handleRemoteForceLeave(message);    
        default:
            console.warn('Event ' + message.cmd);
    }
};
/**
 * onClose
 *
 */
ZeroRTCEngine.prototype.onClose = function (ev) {
    var ecerRTCEnv = this;
    console.warn('websocket close', ev);
    if (ev.code == 1000 && ev.reason == 'wsForcedClose') { // 如果自定义关闭ws连接，避免二次重连
        return;
    }
};
/**
 * onError
 * 相当于WebSocket的错误处理
 */
ZeroRTCEngine.prototype.onError = function (ev) {
    console.error('websocket error', ev);
};

function handleResponseJoin(message) {
    console.info("handleResponseJoin, msg: " + message);
    remoteUserId = message.remoteUid; // 保存新人id
    // var msg = new UserMsg(message.username,null);
    // userMap.put(remoteUserId,msg);
}

function handleRemoteNewPeer(message) {
    console.info("handleRemoteNewPeer, msg: " + message);
    remoteUserId = message.remoteUid; // 保存新人id
    //把加入房间的客户加入usermap
    var msg = new UserMsg(null,0);
    userMap.put(remoteUserId,msg);
    doOffer();
}

function handleRemotePeerLeave(message) {//处理房间有人正常离开
    console.info("handleRemotePeerLeave, msg: " + message);
    var remoteUid=message.remoteUid;//退出的人
    pc = userMap.get(remoteUid).pc;
    var videoshwo=userMap.get(remoteUid).videoShow;
    if (pc != null) {
        pc.close();
        pc = null;
    }
    
    switch(videoshwo){
        case 0:
            remoteVideo1.srcObject=remoteVideo2.srcObject;
            remoteVideo2.srcObject = null;
            break;
        case 1:
            remoteVideo2.srcObject = null;
            break;
        default:
            alert('videoshow close fail..');
            break;
    }
    userMap.remove(remoteUid);
}
// function handleRemoteForceLeave(message){//处理房间有人强制离开
//     console.info("handleRemoteForceLeave, msg: " + message);
    
// }

function handleRemoteOffer(message) {
    // console.log('Remote offer received: ', message.msg);
    console.log('Remote offer received: ');
    var uid = message.uid;//这个uid才是远端uid
    var remoteUid = message.remoteUid;
    if(remoteUid!=localUserId){
        alert('handleRemoteOffer error');
    }
    var msg = new UserMsg(null,0);
    userMap.put(uid,msg);//谁先发offer就要先回复谁,所以要按发offer的顺序put
        
    
    // if (pc == null) {
    //     createPeerConnection()//用默认coturn创建一个peerconnection
    // }
    if (userMap.get(uid).pc == null) {
        createPeerConnection();
        userMap.get(uid).pc=pc;
    }
    if(userMap.get(uid).pc==null){
        alert('handleRemoteOffer pc == null');
    }
    let desc = JSON.parse(message.msg);
    console.log('setRemoteDescription');
    userMap.get(uid).pc.setRemoteDescription(desc);
    doAnswer(uid);
}

function handleRemoteAnswer(message) {
    // console.log('Remote answer received: ', message.msg);
    console.log('Remote answer received: ');
    let desc = JSON.parse(message.msg);
    console.log('setRemoteDescription');
    pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(message) {
    // console.log('Remote candidate received: ', message.msg);
    console.log('Remote candidate received');
    var uid = message.uid;
    var desc = JSON.parse(message.msg);
    var desc2 = {
        'sdpMLineIndex': desc.label,
        'sdpMid': desc.id,
        'candidate': desc.candidate
    };
    var candidate = new RTCIceCandidate(desc2);
    userMap.get(uid).pc.addIceCandidate(candidate).catch(e => {
        console.log("Failure during addIceCandidate(): " + e.name);
    });
}


// 初始化本地媒体流
function initLocalStream(){
    showValue();
    navigator.mediaDevices.getUserMedia({//js中很多函数的返回值都是promise，都可以.then和.catch，是异步执行的，我靠，相当于多线程
        audio: show_audio,
        video: show_video
    })//getUserMedia执行完毕，异步执行，宏观上边执行then，一边执行其他的
        .then(openLocalStream)//初始化之后就马上打开本地媒体流
        .catch(function (e) {//如果出错
            alert('getUserMedia() error: ' + e.name);//打印错误信息
        });
}
//打开本地媒体流，
function openLocalStream(stream) {//promise的then是带了一个返回值的，then调用的函数就用它当参数
    doJoin(roomId);

    console.log('Open local video stream');
    localVideo.srcObject = stream;//stream就是视频流
    localStream = stream;//备份一份流传到远端
}

function closeLocalStream() {
    if(!(localStream === null || localStream === undefined)){
		localStream.getTracks().forEach((track)=>{
			track.stop();
		});
	}
    localStream = null;
    localVideo.srcObject = null;
}
function createPeerConnection() {
    try {
        var defaultConfiguration = {  
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
            iceTransportPolicy:"all",//relay 或者all  all允许做p2p  relay只能中继
            // 修改ice数组测试效果，需要进行封装
            iceServers: [
                {
                    "urls": [
                        "turn:120.24.5.163:3478?transport=udp",
                        "turn:120.24.5.163:3478?transport=tcp"       // 可以插入多个进行备选
                    ],
                    "username": "gyl",
                    "credential": "123456"
                },
                {
                    "urls": [
                        "stun:120.24.5.163:3478"
                    ]
                }
            ]
        };

        pc = new RTCPeerConnection(defaultConfiguration);
        // 获取到candidate事件  这是回调函数，是收到answer自动被调用的，与coturn客户端交互的
        pc.onicecandidate = handleIceCandidate;
        // 远端码流加入事件
        pc.ontrack = handleRemoteStreamAdded;
        // 远端码流删除事件
        pc.onremovestream = handleRemoteStreamRemoved;
         // sdp信令状态
        pc.onsignalingstatechange = handleSignalingStateChange;
        // Peer连接状态
        pc.onconnectionstatechange = handleConnectionStateChange;
        // 用于描述连接的ICE连接状态
        pc.oniceconnectionstatechange = handleIceconnectionStateChange;
        //localStream:本地媒体流
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        console.log('RTCPeerConnnection Created');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

/////////////////////////////////////////////////////////

// 加入房间
function doJoin(roomId) {
    var jsonMsg = {
        'cmd': SIGNAL_TYPE_JOIN,
        'roomId': roomId,
        'uid': localUserId
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);//发送join信令
    console.log("send join: " + message);
}

//离开房间  客户端只需要发送离开信令给信令服务器就行了，服务器通知远端，远端进行处理
//也就是说，客户端只有在收到离开信令才需要处理
function doLeave(roomId) {
    var jsonMsg = {
        'cmd': SIGNAL_TYPE_LEAVE,
        'roomId': roomId,
        'uid': localUserId,
        'remoteUid': remoteUserId
    };
    answer_i=0;
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    console.log("send leave: " + message);
    hangup();//本地处理离开  得要把map清理干净
}
// 创建offer并发送
function doOffer() {
    console.log('Starting offer: Sending offer to remote peer');
    if (userMap.get(remoteUserId).pc == null) {
        createPeerConnection();
        userMap.get(remoteUserId).pc=pc;
    }
    // if (pc == null) {
    //     createPeerConnection();
    // }
    pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError);
}

// 创建answer并发发送
function doAnswer(uid) {
    console.log('Starting answer: Sending answer to remote peer');
    if (userMap.get(uid).pc == null) {
        alert('doAnswer pc == null');
    }
    remoteUserId=uid;
    
    // if (pc == null) {
    //     createPeerConnection();
    // }
    var ret=userMap.get(uid).pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError);
}
//获取本地SDP并且设置到本地
function createOfferAndSendMessage(sessionDescription) {
    console.log('CreateOfferAndSendMessage sending message', sessionDescription);
    pc.setLocalDescription(sessionDescription).then(function() {
        console.log('offer setLocalDescription ok');
        var jsonMsg = {
            'cmd': SIGNAL_TYPE_OFFER,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid':remoteUserId,
            'msg': JSON.stringify(sessionDescription)
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        // console.log('send offer:', message);
        console.log('send offer');
    })
    .catch(function(reason) {
        console.error('offer setLocalDescription failed:' + reason);
    });
     
}

function createAnswerAndSendMessage(sessionDescription) {
    console.log('CreateAnswerAndSendMessage sending message', sessionDescription);
    pc.setLocalDescription(sessionDescription)
    .then(function() {
        if(answer_i>=userMap.size()){
            answer_i=0;
        }
        var map=userMap.getEntrys();
        var tuid=map[answer_i].key;
        answer_i++;
        console.info('answer setLocalDescription ok');
        var jsonMsg = {
            'cmd': SIGNAL_TYPE_ANSWER,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid':tuid,
            'msg': JSON.stringify(sessionDescription)
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        
        // console.log('send answer:', message);
        console.log('send answer:');
    })
    .catch(function(reason) {
        console.error('answer setLocalDescription failed:' + reason);
    });
    
}

function handleCreateOfferError(event) {
    console.error('CreateOffer() error: ', event);
}

function handleCreateAnswerError(error) {
    console.error('CreateAnswer() error: ', error);
}

//网络协商  这个会被反复调用，一般会一次性发四五个candidate来看能不能打通，打不通继续发
function handleIceCandidate(event) {
    console.log('Handle ICE candidate event: ', event);
    // console.log('Handle ICE candidate event: ');
    var map=userMap.getEntrys();
    for(var i=0;i<userMap.size();i++){
        if(map[i].value.pc==this){
            remoteUserId=map[i].key;
            break;
        }
    }
    if (event.candidate) {
        var candidateJson = {
            'label': event.candidate.sdpMLineIndex,
            'id': event.candidate.sdpMid,
            'candidate': event.candidate.candidate
        };
        var jsonMsg = {
            'cmd': SIGNAL_TYPE_CANDIDATE,
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid':remoteUserId,
            'msg': JSON.stringify(candidateJson) 
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        // console.log('send candidate:', message);
        console.log('send candidate');
    } else {
        console.log('End of candidates.');
        p2ping=false;
    }
}

function handleRemoteStreamAdded(e) {
    console.log('Handle remote stream added.');
    // var size=userMap.size();
    remoteStream = e.streams[0];//拿到远端流
    
    if(userMap.size()==1){
        remoteVideo1.srcObject = e.streams[0];//这一步过后就可以显示了
        var map=userMap.getEntrys()[0];
        map.value.videoShow=0;
    }
    else if(userMap.size()==2){
        remoteVideo2.srcObject = e.streams[0];
        var map=userMap.getEntrys()[1];
        map.value.videoShow=1;
    }
    
}

function handleRemoteStreamRemoved(event) {
    console.log('Handle remote stream removed. Event: ', event);
    if(this){
        var map=userMap.getEntrys();
        for(var i in map){
            if(map[i].value.pc==this){
                if(i==0){
                    remoteVideo1.srcObject=null;
                }
                else{
                    remoteVideo2.srcObject=null;
                }
            }
        }
    }
}

function handleSignalingStateChange(){
    if(pc)
        console.info("PeerConnection: signalingState -> ", pc.signalingState);
};

function handleConnectionStateChange() {
    if(pc)
        console.info("PeerConnection: connectionState -> ", pc.connectionState);
}
// 具体状态https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState
function handleIceconnectionStateChange() {
    if(pc)
        console.info("PeerConnection: iceConnectionState -> ", pc.iceConnectionState);
}

//我方离开的处理  doLeave调用
function hangup() {
    console.log('Hanging up !');
    remoteVideo1.srcObject = null;//把远端流设为空
    remoteVideo2.srcObject = null;
    closeLocalStream();//关闭本地流
    var map=userMap.getEntrys();
    for(var i=0;i<userMap.size();i++){
        pc =map[i].value.pc;
        if(pc!=null){
            pc.close();
            pc = null;
        }
    }
    userMap.clear();
}

//MAIN
//这里相当于主函数，程序入口，其他地方就是声明定义
/////////////////////////////////////////////////////////
//创建ZeroRTCEngine类，类中封装了WebSocket，调用createWebsocket自动连接WebSocket，注册事件回调
zeroRTCEngine = new ZeroRTCEngine("wss://120.24.5.163:8081/ws");//信令服务器port
zeroRTCEngine.createWebsocket();

// 通过id拿到加入按钮控件.onclick表示添加一个点击事件，点击事件的响应函数就是后边的function
document.getElementById('joinBtn').onclick = function () {
    roomId = document.getElementById("gyl-roomId").value; //获取roomId
    if (roomId == "" || roomId == "请输入房间ID") {
        alert("请输入房间ID");
        return;
    }
    console.log('doJoin roomId: ' + roomId);
    // userName = document.getElementById("user-name").value;
    initLocalStream();
};
// 响应w我方离开按钮的函数
document.getElementById('leaveBtn').onclick = function () {
    console.log('doLeave');
    doLeave(roomId);//点击了调这个函数
};

function showValue(){
    var t=document.getElementById('show');
    var show_value=t.value;
    switch(show_value){
        case '1':
            show_audio=true;
            show_video=false;
            return;
        case '2':
            show_audio=false;
            show_video=true;
            return;
        case '3':
            show_audio=true;
            show_video=true;
            return;
        default:
            return;
    }
}



