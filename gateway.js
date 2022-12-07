require('dotenv').config();
const amqplib = require('amqplib');

(async()=>{
    try{
    const input = process.argv.slice(2)
    const option = input.splice(0,1)[0]
    const requestInfo = input.slice(2)
    const usernamePassword = input.slice(0,2)
    const routingKeysForPublish = ['register' , 'login', 'bike-request','error','logger' , 'bikes-list']
    const routingKeys = ['register-answer' , 'login-answer' , 'bikes-list-answer' , 'bike-request-answer']
    const correlationId = generateUuid()

    

    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const gateway_queue = await channel.assertQueue('gateway' , {durable:true})
    for(const item of routingKeys)
        await channel.bindQueue(gateway_queue.queue , exchange.exchange , item)

    if(option === 'bikes-list'){
        console.log('bikes-list: ');
        channel.publish(exchange.exchange , routingKeysForPublish[5], Buffer.from('bikes-list'),{
            correlationId:correlationId , 
            persistent:true
        })
    }else{
        if(option ==='register'){
            channel.publish(exchange.exchange , routingKeysForPublish[0] , Buffer.from(JSON.stringify(usernamePassword)),{
                correlationId:correlationId , 
                persistent:true
            })
        }
        else if(option === 'bike-request'){
            channel.publish(exchange.exchange , routingKeysForPublish[1] , Buffer.from(JSON.stringify(usernamePassword)),{
                correlationId:correlationId , 
                persistent:true
            })
        }
    }
    channel.consume(gateway_queue.queue,async (msg)=>{
        if(msg.content){
            if(msg.fields.routingKey === 'register-answer'){
                console.log(msg.content.toString());
            }
            else if(msg.fields.routingKey === 'login-answer'){
                if(JSON.parse(msg.content)){
                    console.log('login done ...');
                    channel.publish(exchange.exchange , routingKeysForPublish[2] , Buffer.from(JSON.stringify(requestInfo)),{
                        correlationId:correlationId , 
                        persistent:true
                    })
                }
                
            }
            else if(msg.fields.routingKey === 'bikes-list-answer'){
                console.log(JSON.parse(msg.content));

            }else if (msg.fields.routingKey === 'bike-request-answer'){
                console.log(msg.content.toString());
                channel.publish(exchange.exchange , routingKeysForPublish[4] , Buffer.from(JSON.stringify(requestInfo.slice(0,1).concat(requestInfo.slice(2)))),{
                    correlationId:correlationId , 
                    persistent:true
                })
            }
            else{
               console.log(msg.fields.routingKey);                 
               console.log('There is an error');
            }
        }

    setTimeout(()=>{
        connection.close()
        process.exit(0)
    },1000)
        },{noAck:true})


    }catch(error){
        console.log(error.message);
    }
    })()



function generateUuid() {
    return Math.random().toString() +
           Math.random().toString() +
           Math.random().toString();
  }