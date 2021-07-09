# How to add Twitter Direct Messages into Twilio Flex
This repo contains a proof of concept Express app for adding Twitter Direct Messages into Twilio Flex.

![Image of Direct Message flow](https://user-images.githubusercontent.com/46247485/125089637-6d7d3280-e0c6-11eb-85fb-b1acf7b21b45.png)

## Provision
1. Install dependencies
```
yarn install
```

2. Run the provision script
```
node provision.js
```

The provision script will request:
* A Twilio Account SID (make sure this relates to an account containing your Flex project)
* A Twilio Auth Token 

The provision script will:
* Create a Studio Flow that passes incoming messages onto Flex
* Creates a Flex Flow using the new Studio Flow and the Chat Service that is provisioned with your Flex project by default (comments signal where you can override these defaults if you prefer)
* Populates a .env file in the flex-twitter directory with necessary Twilio credentials and SIDs

## Start Application
1. Navigate to the application file
```
cd flex-twitter
```

2. Install dependencies
```
yarn install
```

3. Complete the .env file (use the env.example file for guidance):
* A url that the application will be deployedon
* Twitter consumer key and secret
* Twitter access key and secret
* Twitter handle of the account that will be receiving support messages

4. Run the application
```
node server.js
```
