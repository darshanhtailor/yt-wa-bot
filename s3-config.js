require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');

const bucketName = process.env.BUCKET_NAME;
const iamUser = process.env.IAM_USER_KEY;
const iamSecret = process.env.IAM_USER_SECRET;

const uploadToS3 = async(fileName) => {
    try{
        const s3 = new AWS.S3({
            accessKeyId: iamUser,
            secretAccessKey: iamSecret,
            region: 'ap-southeast-2'
        });

        const fileContent = fs.readFileSync(`./${fileName}`);
    
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: fileContent
        };
    
        const data = await s3.upload(params).promise();
        return data['Location'];
    } catch(err){
        console.log(err);
    }
}

module.exports = uploadToS3;