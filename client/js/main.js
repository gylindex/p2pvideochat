'use strict';

// join �������뷿��
// leave �����뿪����
// new-peer ���˼��뷿�䣬֪ͨ�Ѿ��ڷ������
// peer-leave �����뿪���䣬֪ͨ�Ѿ��ڷ������
// offer ����offer���Զ�peer
// answer����offer���Զ�peer
// candidate ����candidate���Զ�peer
const SIGNAL_TYPE_JOIN = "join";
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  // ��֪�����߶Է���˭
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
// �õ���Ƶ�ؼ�
var localVideo = document.querySelector('#localVideo'); // ����ͷ��
var remoteVideo1 = document.querySelector('#remoteVideo1');// Զ��ͷ��
var remoteVideo2 = document.querySelector('#remoteVideo2');// Զ��ͷ��
var zeroRTCEngine;
//
var MyMap = function () {//keyΪ�û�id��valueΪUserMsg
    this._entrys = new Array();//һ�����飬ÿ������Ԫ�ذ���һ��Object����Object.key=key,Object.value=value,

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
    this.get = function (key) {//��key����value��û��key�򷵻�null
        var index = this._getIndex(key);
        return (index != -1) ? this._entrys[index].value : null;
    };
    this.remove = function (key) {//��key�Ƴ�Ԫ��
        var index = this._getIndex(key);
        // if (index != -1) {
        //     this._entrys.splice(index, 1);
        // }
        /**************������ͨ��mapд��******************* */
        /**************����������ͨ��mapд��******************* */
        if (index != -1) {
            if(index!=this._entrys.length-1){//������ɾ�����������һ��Ԫ��
                for(var i=0;index+1+i<this._entrys.length;i++){
                    this._entrys[index+i]=this._entrys[index+1+i];
                    this._entrys[index+i].value.videoShow--;
                }
            }
            this._entrys.splice(this._entrys.length-1, 1);
            
        }
        
        
        
    };
    this.clear = function () {//���
        this._entrys.length = 0;
    };
    this.contains = function (key) {//��key����map���Ƿ��и�key��û�з���false
        var index = this._getIndex(key);
        return (index != -1) ? true : false;
    };
    this.size = function () {//����mapԪ�ظ���
        return this._entrys.length;
    };
    this.getEntrys = function () {//����map��������ôgetEntrys[key]��ȡvalue
        return this._entrys;
    };
    this._getIndex = function (key) {//����key����map��λ���±�
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
function UserMsg(pc,videoshow) {//�����Ϊmap��value
    // this.talkType = talkType;   
    // this.fromName = fromName;   
    this.pc=pc;
    this.videoShow=videoshow;
}

var ZeroRTCEngine = function (wsUrl) {//�൱�ڹ��캯��������ZeroRTCEngine��
    this.init(wsUrl);
    zeroRTCEngine = this;
    return this;
}

ZeroRTCEngine.prototype.init = function (wsUrl) {
    // ����websocket  url
    this.wsUrl = wsUrl;
    /** websocket���� */
    this.signaling = null;
}
//����Websocket��newһ��Websocket����ע�����ӡ��յ����ݡ������رյĴ�����
ZeroRTCEngine.prototype.createWebsocket = function () {
    var zeroRTCEngine = this;
    zeroRTCEngine.signaling = new WebSocket(this.wsUrl);
    zeroRTCEngine.signaling.onopen = function () {//����onopen�Ļص�
        zeroRTCEngine.onOpen();
    };
    zeroRTCEngine.signaling.onmessage = function (ev) {
        zeroRTCEngine.onMessage(ev);
    };
    zeroRTCEngine.signaling.onerror = function (ev) {
        console.error("����websocketʧ��������, msg:" + ev);
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
 * ������WebScoekt�Ĵ���
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
 * WebSocket�յ�����ʱ�Ĵ���
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
        case SIGNAL_TYPE_RESP_JOIN://�����������˼���ʱ���������ᷢresp_join
            handleResponseJoin(message);//������
            return;
        case SIGNAL_TYPE_NEW_PEER:  //�յ�new peer����Ĵ��� Ҫ��ȡ����SDP�����õ����أ������offer���͸�Զ��
            handleRemoteNewPeer(message);
            return;
        case SIGNAL_TYPE_PEER_LEAVE:  // ����Զ���뿪
            handleRemotePeerLeave(message);
            return;
        case SIGNAL_TYPE_OFFER:
            handleRemoteOffer(message);//�յ�offer�Ĵ��� Ҫ����Զ��SDP�������Լ���SDP��Ȼ������answer�ظ�Զ��
            return;                     //������
        case SIGNAL_TYPE_ANSWER:
            handleRemoteAnswer(message);//�յ�answer�Ĵ��� Ҫ����Զ�˵�SDP
            return;
        case SIGNAL_TYPE_CANDIDATE:
            handleRemoteCandidate(message);//�յ�Candidate�Ĵ��� ҪaddIceCandidate
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
    if (ev.code == 1000 && ev.reason == 'wsForcedClose') { // ����Զ���ر�ws���ӣ������������
        return;
    }
};
/**
 * onError
 * �൱��WebSocket�Ĵ�����
 */
ZeroRTCEngine.prototype.onError = function (ev) {
    console.error('websocket error', ev);
};

function handleResponseJoin(message) {
    console.info("handleResponseJoin, msg: " + message);
    remoteUserId = message.remoteUid; // ��������id
    // var msg = new UserMsg(message.username,null);
    // userMap.put(remoteUserId,msg);
}

function handleRemoteNewPeer(message) {
    console.info("handleRemoteNewPeer, msg: " + message);
    remoteUserId = message.remoteUid; // ��������id
    //�Ѽ��뷿��Ŀͻ�����usermap
    var msg = new UserMsg(null,0);
    userMap.put(remoteUserId,msg);
    doOffer();
}

function handleRemotePeerLeave(message) {//���������������뿪
    console.info("handleRemotePeerLeave, msg: " + message);
    var remoteUid=message.remoteUid;//�˳�����
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
// function handleRemoteForceLeave(message){//����������ǿ���뿪
//     console.info("handleRemoteForceLeave, msg: " + message);
    
// }

function handleRemoteOffer(message) {
    // console.log('Remote offer received: ', message.msg);
    console.log('Remote offer received: ');
    var uid = message.uid;//���uid����Զ��uid
    var remoteUid = message.remoteUid;
    if(remoteUid!=localUserId){
        alert('handleRemoteOffer error');
    }
    var msg = new UserMsg(null,0);
    userMap.put(uid,msg);//˭�ȷ�offer��Ҫ�Ȼظ�˭,����Ҫ����offer��˳��put
        
    
    // if (pc == null) {
    //     createPeerConnection()//��Ĭ��coturn����һ��peerconnection
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


// ��ʼ������ý����
function initLocalStream(){
    showValue();
    navigator.mediaDevices.getUserMedia({//js�кܶຯ���ķ���ֵ����promise��������.then��.catch�����첽ִ�еģ��ҿ����൱�ڶ��߳�
        audio: show_audio,
        video: show_video
    })//getUserMediaִ����ϣ��첽ִ�У�����ϱ�ִ��then��һ��ִ��������
        .then(openLocalStream)//��ʼ��֮������ϴ򿪱���ý����
        .catch(function (e) {//�������
            alert('getUserMedia() error: ' + e.name);//��ӡ������Ϣ
        });
}
//�򿪱���ý������
function openLocalStream(stream) {//promise��then�Ǵ���һ������ֵ�ģ�then���õĺ���������������
    doJoin(roomId);

    console.log('Open local video stream');
    localVideo.srcObject = stream;//stream������Ƶ��
    localStream = stream;//����һ��������Զ��
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
            iceTransportPolicy:"all",//relay ����all  all������p2p  relayֻ���м�
            // �޸�ice�������Ч������Ҫ���з�װ
            iceServers: [
                {
                    "urls": [
                        "turn:120.24.5.163:3478?transport=udp",
                        "turn:120.24.5.163:3478?transport=tcp"       // ���Բ��������б�ѡ
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
        // ��ȡ��candidate�¼�  ���ǻص����������յ�answer�Զ������õģ���coturn�ͻ��˽�����
        pc.onicecandidate = handleIceCandidate;
        // Զ�����������¼�
        pc.ontrack = handleRemoteStreamAdded;
        // Զ������ɾ���¼�
        pc.onremovestream = handleRemoteStreamRemoved;
         // sdp����״̬
        pc.onsignalingstatechange = handleSignalingStateChange;
        // Peer����״̬
        pc.onconnectionstatechange = handleConnectionStateChange;
        // �����������ӵ�ICE����״̬
        pc.oniceconnectionstatechange = handleIceconnectionStateChange;
        //localStream:����ý����
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        console.log('RTCPeerConnnection Created');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

/////////////////////////////////////////////////////////

// ���뷿��
function doJoin(roomId) {
    var jsonMsg = {
        'cmd': SIGNAL_TYPE_JOIN,
        'roomId': roomId,
        'uid': localUserId
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);//����join����
    console.log("send join: " + message);
}

//�뿪����  �ͻ���ֻ��Ҫ�����뿪�������������������ˣ�������֪ͨԶ�ˣ�Զ�˽��д���
//Ҳ����˵���ͻ���ֻ�����յ��뿪�������Ҫ����
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
    hangup();//���ش����뿪  ��Ҫ��map����ɾ�
}
// ����offer������
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

// ����answer��������
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
//��ȡ����SDP�������õ�����
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

//����Э��  ����ᱻ�������ã�һ���һ���Է������candidate�����ܲ��ܴ�ͨ����ͨ������
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
    remoteStream = e.streams[0];//�õ�Զ����
    
    if(userMap.size()==1){
        remoteVideo1.srcObject = e.streams[0];//��һ������Ϳ�����ʾ��
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
// ����״̬https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState
function handleIceconnectionStateChange() {
    if(pc)
        console.info("PeerConnection: iceConnectionState -> ", pc.iceConnectionState);
}

//�ҷ��뿪�Ĵ���  doLeave����
function hangup() {
    console.log('Hanging up !');
    remoteVideo1.srcObject = null;//��Զ������Ϊ��
    remoteVideo2.srcObject = null;
    closeLocalStream();//�رձ�����
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
//�����൱����������������ڣ������ط�������������
/////////////////////////////////////////////////////////
//����ZeroRTCEngine�࣬���з�װ��WebSocket������createWebsocket�Զ�����WebSocket��ע���¼��ص�
zeroRTCEngine = new ZeroRTCEngine("wss://120.24.5.163:8081/ws");//���������port
zeroRTCEngine.createWebsocket();

// ͨ��id�õ����밴ť�ؼ�.onclick��ʾ���һ������¼�������¼�����Ӧ�������Ǻ�ߵ�function
document.getElementById('joinBtn').onclick = function () {
    roomId = document.getElementById("gyl-roomId").value; //��ȡroomId
    if (roomId == "" || roomId == "�����뷿��ID") {
        alert("�����뷿��ID");
        return;
    }
    console.log('doJoin roomId: ' + roomId);
    // userName = document.getElementById("user-name").value;
    initLocalStream();
};
// ��Ӧw�ҷ��뿪��ť�ĺ���
document.getElementById('leaveBtn').onclick = function () {
    console.log('doLeave');
    doLeave(roomId);//����˵��������
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



