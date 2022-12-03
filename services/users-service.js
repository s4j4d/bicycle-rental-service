require('dotenv').config();
const amqplib = require('amqplib');

const redis = require('redis').createClient({url:process.env.REDIS_URL_USERS_SERVICE})
redis.on('connect',()=>{
    console.log('redis connected ....');
});

(async()=>{
    try{
    console.log('service running ....');
    await redis.connect()
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const user_queue = await channel.assertQueue('users-service' , {durable:true})
    const routingKeys = ['register' , 'login']
    for(const item of routingKeys)
        await channel.bindQueue(user_queue.queue , exchange.exchange , item)
    channel.consume(user_queue.queue,async (msg)=>{
            const content = JSON.parse(msg.content)
            console.log(JSON.parse(msg.content));
        if(content){
            if(msg.fields.routingKey === 'register'){
                await redis.set(content[0] , content[1])
                console.log('register done !');
            }else{
                const content = JSON.parse(msg.content)
                const password = await redis.get(content[0])
                console.log(password);
                const result = password === content[1]
                console.log(result);
                // channel.sendToQueue(msg.properties.replyTo ,Buffer.from(result.toString()) , {correlationId:msg.properties.correlationId})     
                channel.publish(exchange.exchange,'login-result',Buffer.from(result.toString()) , {correlationId:msg.properties.correlationId})     

            }
        }
    },{noAck:true})
}catch(error){
    console.log(error.message);
}
})()