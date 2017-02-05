require('dotenv').config()

var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');
var util = require('util')
var S3Zipper = require ('aws-s3-zipper');
var fetch = require('node-fetch');

AWS.config.update({
  region: process.env.AWS_REGION
});

var zipper = new S3Zipper({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_BUCKET
});

var sqsurl = 'https://sqs.us-east-1.amazonaws.com/008542732203/zips'


var app = Consumer.create({
  queueUrl: sqsurl,
  handleMessage: function (message, done) {
    // ...
    try{
      var data = JSON.parse(message.Body)

      var zippable = data.zippable
      var updateurl = data.apiUrl
      var userId = data.user_id
      var hash = data.hash


      console.log(util.inspect(data, false, null))

      zipper.filterOutFiles= function(file){
          //file.key
          if(zippable.files && zippable.files.length > 0){
            if(zippable.files.indexOf(file.Key)){
              return file
            }else{
              return null
            }
          }

          return file;
      };

      zipper.zipToS3File ({
        s3FolderName: 'photos/' + zippable.folder
        , s3ZipFileName: hash + '.zip'
      },function(err,result){
          if(err){
            console.error(err);

          }
          else{
              var lastFile = result.zippedFiles[result.zippedFiles.length-1];
              if(lastFile) {
                console.log('last key ', lastFile.Key); // next time start from here

                var body = {
                  status: 'complete',
                  user_id: userId,
                  file: 'photos/' + zippable.folder + '/' + hash + '.zip'
                }

                fetch(updateurl, {
                    method: 'POST',
                    body:    JSON.stringify(body),
                    headers: { 'Content-Type': 'application/json' },
                })
                .then(function(res) {
                    return res.json();
                }).then(function(json) {
                    console.log('success', json);
                    done();
                }).catch(function(err){
                  console.log('error', util.inspect(err, false, null))
                  done();
                });
              }
          }
      });

    }catch(err) {
      //ignore
      done();
    }
  },
  sqs: new AWS.SQS()
});

app.on('error', function (err) {
  console.log(err.message);
});

app.start();