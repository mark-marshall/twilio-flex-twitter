// ================== Package Imports ==================
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const Twitter = require('twit');
const sgMail = require('@sendgrid/mail');
var cors = require('cors');

// ================== Function Imports ==================
const functions = require('./functions');

// ================== Initialise App ==================
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ================== Initialise Clients ==================
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET,
});

// ================== Endpoints ==================
// EP1: Sense check
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Alive!' });
});

// EP2: Twitter Security Check
app.get('/fromTwitter', (req, res) => {
  const crcToken = req.query.crc_token;
  const resToken = functions.generateTwitterToken(crcToken);
  res.status(200).json({ response_token: resToken });
});

// EP3: Webhook from Twitter Customer -> Send Chat to Flex Agent
app.post('/fromTwitter', (req, res) => {
  if (req.body.direct_message_events) {
    const users = req.body.users;
    const customer = users[Object.keys(users)[0]];
    const twitterHandle = customer.screen_name;
    const twitterId = customer.id;
    // Check to make sure this is a message sent from the customer
    // rather than a Direct Message we sent on behalf of the agent from our app
    if (!req.body.direct_message_events[0].message_create.source_app_id) {
      const msg =
        req.body.direct_message_events[0].message_create.message_data.text;
      functions.sendMessageToFlex(twilioClient, msg, twitterHandle, twitterId);
    }
  }
  res.sendStatus(200);
});

// EP4: Webhook from Flex Agent -> Send Twitter DM to Customer
app.post('/fromFlex', async (req, res) => {
  // Source will be 'API' for Twitter customer side, 'SDK' for Flex agent side
  if (req.body.Source === 'SDK') {
    // Get the Twitter id, then send DM via the id
    const channelId = req.body.ChannelSid;
    const twitterId = await functions.getUserFromChannel(
      twilioClient,
      channelId
    );
    const msg = req.body.Body;
    functions.sendMessageToTwitter(twitterClient, msg, twitterId);
  }
  res.sendStatus(200);
});

// SURPLUS
app.post('/sendEmail', async (req, res) => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const { firstName, amount, reason, close } = req.body;
  const msg = {
    to: 'vinnypeters30@gmail.com',
    from: 'mark.marshallgp@gmail.com',
    templateId: 'd-f360ebe35a2a483f93ee85f6c7d09eb3',
    dynamicTemplateData: {
      firstName,
      reason,
      close,
      amount,
    },
  };
  await sgMail.send(msg);
  res.sendStatus(200);
});

module.exports = app;
