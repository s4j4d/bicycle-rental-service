require('dotenv').config();
const amqplib = require('amqplib');

const redis = require('redis').createClient({url:process.env.BICYCLE_URL})
redis.on('connect',()=>{
    console.log('redis connected ....');
});


(async()=>{
    try{
    await redis.connect()
    const routingKeys = ['bike-request' , 'bikes-list']
    const redis_hash_bicycles_list = 'bike-hash'

    console.log('service running ....');
    const connection = await amqplib.connect()
    const channel = await connection.createChannel()
    const exchange = await channel.assertExchange(process.env.EXCHANGE_NAME , process.env.EXCHANGE_TYPE)
    const bicycles_service = await channel.assertQueue('bicycle-service' , {durable:true})
    for(const item of routingKeys)
        await channel.bindQueue(bicycles_service.queue , exchange.exchange , item)

    channel.consume(bicycles_service.queue,async (msg)=>{
            // const content = JSON.parse(msg.content)
            const key = msg.fields.routingKey
            const bicyclesList = await redis.hGetAll(redis_hash_bicycles_list)
            if(key === 'bikes-list'){
                console.log('message content : ' ,msg.content.toString());
                channel.publish(exchange.exchange,'bikes-list-answer',Buffer.from(JSON.stringify(bicyclesList)) ,
                 {correlationId:msg.properties.correlationId})
            }else{
                const content = JSON.parse(msg.content)
                const result = []
                    //check to see if the requested numbers of bicycles exists or we should deny it
                content.forEach(element => {
                    const [bikeKind , number] = element.split(',');
                    if(bicyclesList[bikeKind]>= number){
                        result.push(true)
                    }else{
                        result.push(false)
                    }
                });
                    //informing gateway of integrity of the reuest
                if(result.every(x => x)){
                    channel.publish(exchange.exchange,'bike-request-answer',Buffer.from('request accepted and done') ,
                 {correlationId:msg.properties.correlationId})
                    console.log('request done ...');

                    // writing chnages into the redis db

                 content.forEach(async element => {
                    const [bikeKind , number] = element.split(',');
                    console.log(bikeKind);
                    console.log(number);
                    await redis.hSet(redis_hash_bicycles_list , bikeKind , number )
                });
                    
                }else{
                    console.log('request denied ...');
                    channel.publish(exchange.exchange,'bike-request-answer',Buffer.from('request not possible please try again') ,
                    {correlationId:msg.properties.correlationId})
                }
                    
            }
    },{noAck:true})
}catch(error){
    console.log(error.message);
}
})()