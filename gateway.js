require('dotenv').config();
const amqplib = require('amqplib');
const rabbitConnection = require('./utils');

(async()=>{
    try{
    const input = process.argv.slice(2)
    const option = input[0]
    const usernamePassword = input.slice(1,3)
    const routingKeysForPublish = ['register' , 'login', 'bike-request','error','logger' , 'bicycles-list']
    const routingKeys = ['register-answer' , 'login-answer']
    const correlationId = generateUuid()

    

    console.log('service running ....');
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const user_queue = await channel.assertQueue(queueName , {durable:true})
    for(const item of routingKeys)
        await channel.bindQueue(user_queue.queue , exchange.exchange , item)

    if(option === 'bicycles-list'){
        channel.publish(exchange.exchange , routingKeysForPublish[5] ,{
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
        else{
            channel.publish(exchange.exchange , routingKeysForPublish[1] , Buffer.from(JSON.stringify(usernamePassword)),{
                correlationId:correlationId , 
                persistent:true
            })
        }
    }
    channel.consume(user_queue.queue,async (msg)=>{
        if(msg.content){
            if(msg.fields.routingKey === 'register-answer'){
                console.log(msg.content.toString());
            }
            else if(msg.fields.routingKey === 'login-answer'){
                const content = JSON.parse(msg.content)
                if(content){
                    channel.publish(exchange.exchange , routingKeysForPublish[1] , Buffer.from(JSON.stringify(usernamePassword)),{
                        correlationId:correlationId , 
                        persistent:true
                    })
                }
                else if(msg.fields.routingKey === 'bicycles-list'){
                    console.log(content);

                }else{
                    console.log('not authorized');
                }
            }
            else{}
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