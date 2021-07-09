// ================== Package Imports ==================
const base64 = require('base-64');
const fetch = require('node-fetch');
const { createHmac } = require('crypto');

// ================== Functions (A-Z Ordered) ==================
const getChannel = async (
  twilioClient,
  flexFlowSid,
  flexChatServiceSid,
  twitterHandle,
  twitterId
) => {
  let flexChannel;
  try {
    const channelExists = await hasOpenChannel(twilioClient, twitterHandle);
    // Identity is unique per channel, if we create a new channel that already exists, there's no penalty to that
    // We need the channel SID anyway to send the message so we go ahead and do this every time
    flexChannel = await twilioClient.flexApi.channel.create({
      flexFlowSid,
      identity: twitterHandle,
      chatUserFriendlyName: `Twitter with @${twitterHandle}`,
      chatFriendlyName: twitterId,
      target: `@${twitterHandle}`,
    });
    // Duplicating webhooks results in duplicate flows between Twitter and Flex
    if (!channelExists) {
      await twilioClient.chat
        .services(flexChatServiceSid)
        .channels(flexChannel.sid)
        .webhooks.create({
          type: 'webhook',
          configuration: {
            method: 'POST',
            url: `${process.env.NGROK_URL}/fromFlex`,
            filters: ['onMessageSent'],
          },
        });
    }
  } catch (e) {
    console.error(e);
  }
  return flexChannel;
};

const generateTwitterToken = (crcToken) => {
  // Source: https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/securing-webhooks
  const hmac = createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET)
    .update(crcToken)
    .digest('base64');
  const resToken = `sha256=${hmac}`;
  return resToken;
};

const getTwitterMessageData = (msg) => {
  let formattedMsg = msg;
  let optionsObj = {};
  let ctaObj = {};
  // Quick Reply structure is assumed as (1) Msg <Options keyword> (2) <Options list> where each option is
  // separated by "," and descriptions for each option are seperated from the option title by a "-"
  if (msg.includes('Options')) {
    const msgSplit = msg.split('Options');
    const optionsSplit = msgSplit[1].split(',');
    formattedMsg = msgSplit[0];
    const options = optionsSplit.map((op) => {
      const optionDescSplit = op.split('-');
      const option = {
        label: optionDescSplit[0],
      };
      if (optionDescSplit.length > 1) {
        option.description = optionDescSplit[1];
      }
      return option;
    });
    // Package the Quick Reply object
    optionsObj = {
      quick_reply: {
        type: 'options',
        options,
      },
    };
  }
  if (msg.includes('Link')) {
    const msgSplit = msg.split('Link');
    formattedMsg = msgSplit[0];
    const CTAConfig = msgSplit[1].split(',');
    // Package the CTA object
    ctaObj = {
      ctas: [
        {
          type: 'web_url',
          label: CTAConfig[0],
          url: CTAConfig[1],
        },
      ],
    };
  }
  // Structure for message_data property on Twitter request
  const messageData = { text: formattedMsg, ...optionsObj, ...ctaObj };
  return messageData;
};

const getUserFromChannel = async (twilioClient, channelId) => {
  const chat = await twilioClient.chat
    .services(process.env.FLEX_CHAT_SERVICE)
    .channels(channelId)
    .fetch();
  const twitterId = chat.friendlyName;
  return twitterId;
};

const hasOpenChannel = async (twilioClient, twitterHandle) => {
  const channels = await twilioClient.chat
    .services(process.env.FLEX_CHAT_SERVICE)
    .channels.list();
  const openChannelExists =
    channels.filter((c) => {
      const { from, status } = JSON.parse(c.attributes);
      // Channels are automatically set to INACTIVE when they are ended by a Flex Agent
      return from.includes(twitterHandle) && status !== 'INACTIVE';
    }).length > 0;
  return openChannelExists;
};

const sendChatMessage = async (
  flexChatServiceSid,
  flexChannelSid,
  twitterHandle,
  msg
) => {
  // Source: https://www.twilio.com/blog/add-custom-chat-channel-twilio-flex
  const params = new URLSearchParams();
  params.append('Body', msg);
  params.append('From', twitterHandle);
  const res = await fetch(
    `https://chat.twilio.com/v2/Services/${flexChatServiceSid}/Channels/${flexChannelSid}/Messages`,
    {
      method: 'post',
      body: params,
      headers: {
        'X-Twilio-Webhook-Enabled': 'true',
        Authorization: `Basic ${base64.encode(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        )}`,
      },
    }
  );
  return res;
};

const sendMessageToFlex = async (
  twilioClient,
  msg,
  twitterHandle,
  twitterId
) => {
  const flexChanel = await getChannel(
    twilioClient,
    process.env.FLEX_FLOW_SID,
    process.env.FLEX_CHAT_SERVICE,
    twitterHandle,
    twitterId
  );
  await sendChatMessage(
    process.env.FLEX_CHAT_SERVICE,
    flexChanel.sid,
    twitterHandle,
    msg
  );
};

const sendMessageToTwitter = async (twitterClient, msg, twitterId) => {
  // Parse the message for Quick Replies and CTA Buttons: https://developer.twitter.com/en/docs/twitter-api/v1/direct-messages/api-features
  const messageData = getTwitterMessageData(msg);
  twitterClient.post(
    'direct_messages/events/new',
    {
      event: {
        type: 'message_create',
        message_create: {
          target: {
            recipient_id: twitterId,
          },
          message_data: messageData,
        },
      },
    },
    (error) => {
      if (error) {
        console.error(error);
      }
    }
  );
};

module.exports = {
  generateTwitterToken,
  getUserFromChannel,
  sendMessageToFlex,
  sendMessageToTwitter,
};
