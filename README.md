# p2pvideochat
基于webrtc的音视频通话项目
# 环境配置
###### STUN服务器

- STUN（SessionTraversalUtilitiesforNAT，NAT会话穿越应用程序）是一种网络协议，它允许位于NAT（或多重NAT）后的**客户端找出自己的公网地址**，查出自己位于哪种类型的NAT之后以及NAT为某一个本地端口所绑定的Internet端端口。这些信息被用来在两个同时处于NAT路由器之后的主机之间创建UDP通信。该协议由RFC5389定义。
- 使用一句话说明STUN做的事情就是：告诉我你的公网IP地址+端口是什么。搭建STUN服务器很简单，媒体流传输是按照P2P的方式。
- 使用STUN，获取公网ip+port，公网ip之间p2p打通，通话成功，公网ip之间p2p打不通，用TURN

###### TURN

- TURN的全称为TraversalUsingRelaysaroundNAT，是STUN/RFC5389的一个拓展，主要添加了Relay功能。如果终端在NAT之后，那么在特定的情景下，有可能使得终端无法和其对等端（peer）进行直接的通信，这时就需要公网的服务器作为一个中继，对来往的数据进行转发。这个转发的协议就被定义为TURN。
- 这种方式的带宽由服务器端承担（一般：单向数据200kbps一对一通话）
- 中继服务比较耗费服务器的带宽（200*4）

###### conturn

- 以上是WebRTC中经常用到的2个协议，STUN和TURN服务器我们使用coturn开源项目来搭建。
- coturn开源项目集成了STUN和TURN的功能。
- 功能：获取公网ip+port的功能


###### nodejs

nodejs主要实现信令服务器的功能，也可以做web服务器

###### npm和cnpm

npm（node package manager）：nodejs的包管理器，用于node插件管理（包括安装、卸载、管理依赖等） 
cnpm:因为npm安装插件是从国外服务器下载，受网络的影响比较大，可能会出现异常，如果npm的服务器在中国就好了，所以我们乐于分享的淘宝团队干了这事。来自官网：“这是一个完整 npmjs.org 镜像，你可以用此代替官方版本(只读)，同步频率目前为 10分钟 一次以保证尽量与官方服务同步。”

###### 测试conturn

```shell
#后台运行coturn，日志重定向到当前目录的nohup.out文件中；
#gyl:123456是用户名和密码，随便输，使用这个服务器要用到这个密码
nohup turnserver -L 0.0.0.0 -a -u gyl:123456 -v -f -r nort.gov &
#测试网址
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```

###### 配置nginx：

为什么要配置nginx？

- 首先，nodejs作为web服务器的话只支持http，要用https的话就必须用nginx把https代理成http
- 其次，可以发现，如果要用这个一对一通话，我们必须拿到客户端代码，也就是html和js文件，我们双击html文件可以打开客户端，也会去尝试连接到服务器，
- 那么就有一个缺点，难道必须有这个文件才能通话吗？配置nginx就能解决这个问题。
- 总之，nginx还能作为一个web服务器让我们拿到js代码，但其实nodejs也支持作为web服务器，主要还是第一点
- 把客户端代码传到云服务器里去，nginx配置中加入这个路径，并配置一个域名或ip，我们只需要请求这个域名，服务器就会传回客户端页面，做到随时随地访问，不需要准备任何东西，只需要能上网，有浏览器就行
- 因为我们要配置https，https相当于wss，是安全的，http相当于ws，是不安全的，https无法降级访问ws
- 要用我们通过nginx的https访问443端口，拿到服务器的html页面文件，然后html页面文件中的客户端是用wss访问的nginx的7778端口，nginx为我们代理到7777端口，7777端口是nodejs信令服务器，与信令服务器建立起ws连接

###### nginx配置文件

- 在conf目录下创建conf.d目录

- 在conf.d目录下创建webrtc­https.conf文件

- 在conf目录下自带的配置文件nginx.conf的末尾}之前添加一句`include ./conf.d/*.conf;`，这样conf.d下的配置文件会加进来

- ```shell
  #配置web服务器
  server {
          listen 443 ssl;		#一定要开放443端口
          ssl_certificate         cert/7504997_gongyuanlin.cn.pem;
          ssl_certificate_key     cert/7504997_gongyuanlin.cn.key;
          charset utf‐8;
          # ip地址或者域名
          server_name gongyuanlin.cn;
          location / {
          add_header 'Access‐Control‐Allow‐Origin' '*';
          add_header 'Access‐Control‐Allow‐Credentials' 'true';
          add_header 'Access‐Control‐Allow‐Methods' '*';
          add_header 'Access‐Control‐Allow‐Headers' 'Origin, X‐Requested‐With, Content‐Type,Accept';
          # web页面所在目录
          root    /home/gyl/develop/webrtc/node/one2oneqq/client;
          index   index.php index.html index.htm;
      }
  #这个是https的server，访问根目录，返回client下的html文件
  }
  ```

- ```shell
  #配置websocket代理
  
  #Nginx主要是提供wss连接的支持，https必须调用wss的连接
  
  #在conf.d目录下创建`webrtc-websocket-proxy.conf`文件
  map $http_upgrade $connection_upgrade{
      default upgrade;
      '' close;
  }
  upstream websocket{
      server 120.24.5.163:7777;
  }
  server{
      listen 7778 ssl;
      #ssl on;
      ssl_certificate     cert/7504997_gongyuanlin.cn.pem;
      ssl_certificate_key cert/7504997_gongyuanlin.cn.key;
      server_name gongyuanlin.cn;
      location /ws{
      proxy_pass http://websocket;
      proxy_http_version 1.1;
      proxy_connect_timeout 4s; #配置点1
      proxy_read_timeout 6000s; #配置点2，如果没效，可以考虑这个时间配置长一点
      proxy_send_timeout 6000s; #配置点3
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      }
  }
  
  ```

# 启动服务

###### 启动服务器

配置好环境之后，在服务器端运行signal_server.js文件

```shell
node signal_server.js &
```

###### 启动nginx

```shell
./objs/nginx -c /home/gyl/develop/webrtc/node/one2oneqq/nginx-1.15.8/conf/nginx.conf
```

###### 启动conturn

```shell
nohup turnserver -L 0.0.0.0 -a -u gyl:123456 -v -f -r nort.gov &
```

web访问域名https://gongyuanlin.cn/
