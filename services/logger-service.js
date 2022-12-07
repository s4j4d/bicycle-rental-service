require('dotenv').config();
const amqplib = require('amqplib');

const redis = require('redis').createClient({url:process.env.LOGGER_URL})
redis.on('connect',()=>{
    console.log('redis connected ....');
});

(async()=>{
    try{
    await redis.connect()
    const routingKeys = ['register-answer-log' , 'login-answer-log' , 'bike-request-answer-log' , 'error' , 'successful-request-log']
    

    console.log('service running ....');
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const logger_service = await channel.assertQueue('logger-service' , {durable:true})
    for(const item of routingKeys)
        await channel.bindQueue(logger_service.queue , exchange.exchange , item)
    channel.consume(logger_service.queue,async (msg)=>{
            const content = JSON.parse(msg.content);
            if(content){
                if(msg.fields.routingKey === 'register-answer-log'){
                    await redis.set(`registerLog : ${content}` , new Date().toTimeString())
                    console.log(`registerLog : ${content}` , new Date().toTimeString() );

                }else if(msg.fields.routingKey === 'successful-request-log'){
                    await redis.set( `requestLog : ${content}` , new Date().toTimeString())
                    console.log(`requestLog : ${content}`, new Date().toTimeString());

                }else{

                }
        }
    },{noAck:true})
}catch(error){
    console.log(error.message);
}
})()