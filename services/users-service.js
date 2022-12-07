require('dotenv').config();
const amqplib = require('amqplib');

const redis = require('redis').createClient({url:process.env.USERS_URL})
redis.on('connect',()=>{
    console.log('redis connected ....');
});

(async()=>{
    try{
    await redis.connect()
    const routingKeys = ['register' , 'login']
    

    console.log('service running ....');
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const users_service = await channel.assertQueue('users-service' , {durable:true})
    for(const item of routingKeys)
        await channel.bindQueue(users_service.queue , exchange.exchange , item)

    channel.consume(users_service.queue,async (msg)=>{
            const content = JSON.parse(msg.content)
            console.log(JSON.parse(msg.content));
            const key = msg.fields.routingKey
        if(content){

            if(key === 'register'){
                await redis.set(content[0] , content[1])
                console.log('register done !');
                channel.publish(exchange.exchange,'register-answer',Buffer.from('register done.') , {correlationId:msg.properties.correlationId})

            }else{
                const content = JSON.parse(msg.content)
                const password = await redis.get(content[0])
                // console.log(password);
                const result = password === content[1]
                console.log('login result :',result);
                // channel.sendToQueue(msg.properties.replyTo ,Buffer.from(result.toString()) , {correlationId:msg.properties.correlationId})     
                channel.publish(exchange.exchange,'login-answer',Buffer.from(result.toString()) , {correlationId:msg.properties.correlationId})     

            }
        }
    },{noAck:true})
}catch(error){
    console.log(error.message);
}
})()