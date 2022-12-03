require('dotenv').config();
const amqplib = require('amqplib');

(async()=>{
    try{
    const input = process.argv.slice(2)
    const option = input[0]
    const usernamePassword = input.slice(1,3)
    console.log('gateway running ....');
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const user_queue = await channel.assertQueue('gateway' , {durable:true})
    const routingKeys = ['register' , 'login', 'logger-service','bicycle-service']
    const correlationId = generateUuid()
    for(const item of routingKeys)
        await channel.bindQueue(user_queue.queue , exchange.exchange , item)

    if(option ==='register'){
        channel.publish(exchange.exchange , routingKeys[0] , Buffer.from(JSON.stringify(usernamePassword)),{
            correlationId:correlationId , 
            persistent:true
        })
    }
    else{
        channel.publish(exchange.exchange , routingKeys[1] , Buffer.from(JSON.stringify(usernamePassword)),{
            correlationId:correlationId , 
            persistent:true
        })
        channel.consume(user_queue.queue,async (msg)=>{
                const content = JSON.parse(msg.content)
                console.log(JSON.parse(msg.content));
            if(content){
            }
        },{noAck:true})
    }

    setTimeout(()=>{
        connection.close()
        process.exit(0)
    },1000)
}catch(error){
    console.log(error.message);
}
})()



function generateUuid() {
    return Math.random().toString() +
           Math.random().toString() +
           Math.random().toString();
  }